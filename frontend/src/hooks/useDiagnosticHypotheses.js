import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../apiClient';

function createEmptyState() {
  return {
    data: null,
    error: '',
    loading: false,
  };
}

export default function useDiagnosticHypotheses({
  templateId,
  structuredText,
  onProfileUpdate,
}) {
  const [state, setState] = useState(createEmptyState);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setState(createEmptyState());
  }, []);

  useEffect(() => {
    reset();
  }, [reset, structuredText, templateId]);

  const generate = useCallback(async () => {
    if (!templateId || !String(structuredText || '').trim()) {
      setState({
        data: null,
        error: 'Organize a anamnese antes de solicitar hipóteses diagnósticas.',
        loading: false,
      });
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, error: '', loading: true }));

    const response = await api.post('/diagnostic-hypotheses', {
      template: templateId,
      structuredText,
    });

    if (requestIdRef.current !== requestId) {
      return null;
    }

    if (response.data?.profile) {
      onProfileUpdate?.(response.data.profile);
    }

    if (!response.success) {
      setState({
        data: null,
        error: response.error || 'Não foi possível sugerir hipóteses diagnósticas agora.',
        loading: false,
      });
      return null;
    }

    setState({ data: response.data, error: '', loading: false });
    return response.data;
  }, [onProfileUpdate, structuredText, templateId]);

  return {
    ...state,
    generate,
    reset,
  };
}
