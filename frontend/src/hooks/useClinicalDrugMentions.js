import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../apiClient';

const SEARCH_DEBOUNCE_MS = 260;
const MAX_AUTOCOMPLETE_RESULTS = 8;
const MAX_DETECTED_MENTIONS = 10;
const MENTION_REGEX = /(^|[\s([{:;,])@([a-z0-9]+(?:-[a-z0-9]+)*)/gi;

function extractMentionSlugs(text) {
  const slugs = [];
  const seen = new Set();
  let match = MENTION_REGEX.exec(text || '');

  while (match) {
    const slug = String(match[2] || '').toLowerCase();

    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }

    match = MENTION_REGEX.exec(text || '');
  }

  return slugs.slice(0, MAX_DETECTED_MENTIONS);
}

function findMentionTrigger(text, cursorPosition) {
  const cursor = Number.isFinite(cursorPosition) ? cursorPosition : String(text || '').length;
  const prefix = String(text || '').slice(0, cursor);
  const atMatch = prefix.match(/(^|[\s([{:;,])@([a-zA-Z0-9-]{0,80})$/);

  if (atMatch) {
    const markerIndex = prefix.lastIndexOf('@');

    return {
      type: 'mention',
      start: markerIndex,
      end: cursor,
      query: atMatch[2] || '',
    };
  }

  const remedyMatch = prefix.match(/(^|\s)\/remedio(?:\s+([^\n@]{0,80}))?$/i);

  if (remedyMatch) {
    const markerIndex = prefix.toLowerCase().lastIndexOf('/remedio');

    return {
      type: 'command',
      start: markerIndex,
      end: cursor,
      query: remedyMatch[2] || '',
    };
  }

  return null;
}

function canSearchTrigger(trigger) {
  if (!trigger) {
    return false;
  }

  const query = trigger.query.trim();
  return query.length === 0 || query.length >= 2;
}

function normalizeDrug(drug) {
  if (!drug?.slug || !drug?.activeIngredient) {
    return null;
  }

  return drug;
}

function mergeDrugIntoCache(currentCache, drug) {
  const normalizedDrug = normalizeDrug(drug);

  if (!normalizedDrug) {
    return currentCache;
  }

  return {
    ...currentCache,
    [normalizedDrug.slug]: normalizedDrug,
  };
}

export function useClinicalDrugMentions({
  enabled,
  inputRef,
  onTextChange,
  text,
}) {
  const [trigger, setTrigger] = useState(null);
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [drugCache, setDrugCache] = useState({});
  const [activeDrug, setActiveDrug] = useState(null);
  const [loadingActiveDrug, setLoadingActiveDrug] = useState(false);

  const mentionedSlugs = useMemo(() => extractMentionSlugs(text), [text]);
  const detectedMentions = useMemo(
    () => mentionedSlugs.map((slug) => ({ slug, drug: drugCache[slug] || null })),
    [drugCache, mentionedSlugs],
  );

  const rememberDrugs = useCallback((drugs) => {
    const normalizedDrugs = (Array.isArray(drugs) ? drugs : [drugs]).map(normalizeDrug).filter(Boolean);

    if (normalizedDrugs.length === 0) {
      return;
    }

    setDrugCache((currentCache) => normalizedDrugs.reduce(mergeDrugIntoCache, currentCache));
  }, []);

  const updateTriggerFromCursor = useCallback((nextText, cursorPosition) => {
    if (!enabled) {
      setTrigger(null);
      return;
    }

    const nextTrigger = findMentionTrigger(nextText, cursorPosition);
    setTrigger(nextTrigger);
    setHighlightedIndex(0);
  }, [enabled]);

  const handleTextChange = useCallback((event) => {
    const nextText = event.target.value;
    const cursorPosition = event.target.selectionStart;

    onTextChange(nextText);
    updateTriggerFromCursor(nextText, cursorPosition);
  }, [onTextChange, updateTriggerFromCursor]);

  const handleCursorActivity = useCallback(() => {
    const textarea = inputRef?.current;

    if (!textarea) {
      return;
    }

    updateTriggerFromCursor(textarea.value, textarea.selectionStart);
  }, [inputRef, updateTriggerFromCursor]);

  const closeAutocomplete = useCallback(() => {
    setTrigger(null);
    setResults([]);
    setSearchError('');
    setHighlightedIndex(0);
  }, []);

  const insertDrugMention = useCallback((drug) => {
    const normalizedDrug = normalizeDrug(drug);

    if (!normalizedDrug || !trigger) {
      return;
    }

    const textarea = inputRef?.current;
    const currentText = textarea?.value ?? text;
    const start = trigger.start;
    const end = trigger.end;
    const before = currentText.slice(0, start);
    const after = currentText.slice(end);
    const prefix = before && !/\s$/.test(before) ? ' ' : '';
    const token = `${prefix}@${normalizedDrug.slug} `;
    const nextText = `${before}${token}${after}`;
    const nextCursor = before.length + token.length;

    onTextChange(nextText);
    rememberDrugs(normalizedDrug);
    closeAutocomplete();

    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [closeAutocomplete, inputRef, onTextChange, rememberDrugs, text, trigger]);

  const handleTextKeyDown = useCallback((event) => {
    if (!trigger) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAutocomplete();
      return;
    }

    if (!results.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertDrugMention(results[highlightedIndex] || results[0]);
    }
  }, [closeAutocomplete, highlightedIndex, insertDrugMention, results, trigger]);

  const openDrugDetail = useCallback(async (slug) => {
    const normalizedSlug = String(slug || '').trim().toLowerCase();

    if (!enabled || !normalizedSlug) {
      return;
    }

    const cachedDrug = drugCache[normalizedSlug];

    if (cachedDrug) {
      setActiveDrug(cachedDrug);
      return;
    }

    setLoadingActiveDrug(true);
    const response = await api.get(`/clinical-drugs?slug=${encodeURIComponent(normalizedSlug)}`);

    if (response.success && response.data) {
      rememberDrugs(response.data);
      setActiveDrug(response.data);
    }

    setLoadingActiveDrug(false);
  }, [drugCache, enabled, rememberDrugs]);

  useEffect(() => {
    if (!enabled) {
      closeAutocomplete();
      setActiveDrug(null);
    }
  }, [closeAutocomplete, enabled]);

  useEffect(() => {
    if (!enabled || !trigger) {
      setResults([]);
      setLoadingResults(false);
      return undefined;
    }

    if (!canSearchTrigger(trigger)) {
      setResults([]);
      setLoadingResults(false);
      setSearchError('');
      return undefined;
    }

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingResults(true);
      setSearchError('');

      const params = new URLSearchParams({
        q: trigger.query.trim(),
        limit: String(MAX_AUTOCOMPLETE_RESULTS),
      });
      const response = await api.get(`/clinical-drugs?${params.toString()}`);

      if (ignore) {
        return;
      }

      if (response.success && Array.isArray(response.data)) {
        setResults(response.data);
        rememberDrugs(response.data);
      } else {
        setResults([]);
        setSearchError(response.error || 'Não foi possível buscar medicamentos.');
      }

      setLoadingResults(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, rememberDrugs, trigger]);

  useEffect(() => {
    if (!enabled || mentionedSlugs.length === 0) {
      return undefined;
    }

    const missingSlugs = mentionedSlugs.filter((slug) => !drugCache[slug]);

    if (missingSlugs.length === 0) {
      return undefined;
    }

    let ignore = false;

    async function loadMissingDrugs() {
      const loadedDrugs = [];

      for (const slug of missingSlugs.slice(0, MAX_DETECTED_MENTIONS)) {
        const response = await api.get(`/clinical-drugs?slug=${encodeURIComponent(slug)}`);

        if (ignore) {
          return;
        }

        if (response.success && response.data) {
          loadedDrugs.push(response.data);
        }
      }

      if (!ignore) {
        rememberDrugs(loadedDrugs);
      }
    }

    loadMissingDrugs();

    return () => {
      ignore = true;
    };
  }, [drugCache, enabled, mentionedSlugs, rememberDrugs]);

  return {
    activeDrug,
    closeActiveDrug: () => setActiveDrug(null),
    closeAutocomplete,
    detectedMentions,
    handleCursorActivity,
    handleTextChange,
    handleTextKeyDown,
    highlightedIndex,
    insertDrugMention,
    loadingActiveDrug,
    loadingResults,
    openDrugDetail,
    results,
    searchError,
    setHighlightedIndex,
    trigger,
  };
}

export default useClinicalDrugMentions;
