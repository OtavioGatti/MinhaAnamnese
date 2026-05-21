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
  const [missingDrugSlugs, setMissingDrugSlugs] = useState(() => new Set());
  const [loadingDetectedSlugs, setLoadingDetectedSlugs] = useState(() => new Set());
  const [activeDrug, setActiveDrug] = useState(null);
  const [loadingActiveDrug, setLoadingActiveDrug] = useState(false);

  const mentionedSlugs = useMemo(() => extractMentionSlugs(text), [text]);
  const detectedMentions = useMemo(
    () => mentionedSlugs.map((slug) => {
      const drug = drugCache[slug] || null;
      const status = drug
        ? 'ready'
        : loadingDetectedSlugs.has(slug)
          ? 'loading'
          : missingDrugSlugs.has(slug)
            ? 'missing'
            : 'pending';

      return { slug, drug, status };
    }),
    [drugCache, loadingDetectedSlugs, mentionedSlugs, missingDrugSlugs],
  );

  const rememberDrugs = useCallback((drugs) => {
    const normalizedDrugs = (Array.isArray(drugs) ? drugs : [drugs]).map(normalizeDrug).filter(Boolean);

    if (normalizedDrugs.length === 0) {
      return;
    }

    setDrugCache((currentCache) => normalizedDrugs.reduce(mergeDrugIntoCache, currentCache));
    setMissingDrugSlugs((currentSlugs) => {
      const nextSlugs = new Set(currentSlugs);
      normalizedDrugs.forEach((drug) => nextSlugs.delete(drug.slug));
      return nextSlugs;
    });
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

    if (missingDrugSlugs.has(normalizedSlug)) {
      return;
    }

    setLoadingActiveDrug(true);
    const response = await api.get(`/clinical-drugs?slug=${encodeURIComponent(normalizedSlug)}`);

    if (response.success && response.data) {
      rememberDrugs(response.data);
      setActiveDrug(response.data);
    } else if (response.status === 404 || response.code === 'NOT_FOUND') {
      setMissingDrugSlugs((currentSlugs) => new Set(currentSlugs).add(normalizedSlug));
    }

    setLoadingActiveDrug(false);
  }, [drugCache, enabled, missingDrugSlugs, rememberDrugs]);

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

    const missingSlugs = mentionedSlugs.filter((slug) => !drugCache[slug] && !missingDrugSlugs.has(slug));

    if (missingSlugs.length === 0) {
      return undefined;
    }

    let ignore = false;
    const slugsToLoad = missingSlugs.slice(0, MAX_DETECTED_MENTIONS);

    async function loadMissingDrugs() {
      const loadedDrugs = [];
      const notFoundSlugs = [];

      setLoadingDetectedSlugs((currentSlugs) => {
        const nextSlugs = new Set(currentSlugs);
        slugsToLoad.forEach((slug) => nextSlugs.add(slug));
        return nextSlugs;
      });

      for (const slug of slugsToLoad) {
        const response = await api.get(`/clinical-drugs?slug=${encodeURIComponent(slug)}`);

        if (ignore) {
          return;
        }

        if (response.success && response.data) {
          loadedDrugs.push(response.data);
        } else if (response.status === 404 || response.code === 'NOT_FOUND') {
          notFoundSlugs.push(slug);
        }
      }

      if (!ignore) {
        rememberDrugs(loadedDrugs);
        if (notFoundSlugs.length > 0) {
          setMissingDrugSlugs((currentSlugs) => {
            const nextSlugs = new Set(currentSlugs);
            notFoundSlugs.forEach((slug) => nextSlugs.add(slug));
            return nextSlugs;
          });
        }
        setLoadingDetectedSlugs((currentSlugs) => {
          const nextSlugs = new Set(currentSlugs);
          slugsToLoad.forEach((slug) => nextSlugs.delete(slug));
          return nextSlugs;
        });
      }
    }

    loadMissingDrugs();

    return () => {
      ignore = true;
      setLoadingDetectedSlugs((currentSlugs) => {
        const nextSlugs = new Set(currentSlugs);
        slugsToLoad.forEach((slug) => nextSlugs.delete(slug));
        return nextSlugs;
      });
    };
  }, [drugCache, enabled, mentionedSlugs, missingDrugSlugs, rememberDrugs]);

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
