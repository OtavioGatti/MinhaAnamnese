import { useEffect, useState } from 'react';
import { api } from '../apiClient';

// Busca compartilhada da tabela CID-10: usada na aba de Prescrições e no campo
// de CID do atestado. O médico digita código ("n30") ou termo ("cistite") —
// quem resolve a ambiguidade é o backend.
const SEARCH_DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

export function useCid10Search(query, { enabled = true, limit = 20 } = {}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmedQuery = String(query || '').trim();

  useEffect(() => {
    if (!enabled || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let ignore = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: trimmedQuery, limit: String(limit) });

      try {
        const response = await api.get(`/cid10?${params.toString()}`);

        if (ignore) {
          return;
        }

        if (response.success && Array.isArray(response.data)) {
          setResults(response.data);
          setError('');
        } else {
          setResults([]);
          setError(response.error || 'Não foi possível consultar a tabela CID-10.');
        }
      } catch (requestError) {
        if (!ignore) {
          setResults([]);
          setError(requestError.message || 'Não foi possível consultar a tabela CID-10.');
        }
      }

      if (!ignore) {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, limit, trimmedQuery]);

  return {
    results,
    loading,
    error,
    isQueryTooShort: trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH,
  };
}

export { MIN_QUERY_LENGTH };
