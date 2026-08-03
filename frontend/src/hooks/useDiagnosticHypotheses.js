import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../apiClient';

function createEmptyState() {
  return {
    data: null,
    error: '',
    loading: false,
    generatedFor: '',
  };
}

// Assinatura do texto usado na última geração. Normaliza espaços para que
// ajustes irrelevantes de formatação não marquem a análise como desatualizada.
function buildTextSignature(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export default function useDiagnosticHypotheses({
  templateId,
  structuredText,
  onProfileUpdate,
}) {
  const [state, setState] = useState(createEmptyState);
  const requestIdRef = useRef(0);
  const currentSignature = buildTextSignature(structuredText);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setState((current) => (
      current.data || current.error || current.loading ? createEmptyState() : current
    ));
  }, []);

  // Trocar de template invalida a análise: a estrutura do texto muda por completo.
  useEffect(() => {
    reset();
  }, [reset, templateId]);

  // Limpar a saída organizada (nova anamnese) também zera o painel.
  useEffect(() => {
    if (!currentSignature) {
      reset();
    }
  }, [currentSignature, reset]);

  const generate = useCallback(async () => {
    const signature = buildTextSignature(structuredText);

    if (!templateId || !signature) {
      setState({
        data: null,
        error: 'Organize a anamnese antes de solicitar hipóteses diagnósticas.',
        loading: false,
        generatedFor: '',
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
      // Preserva a análise anterior: uma falha de rede não deve apagar o que
      // o usuário já tinha em tela.
      setState((current) => ({
        ...current,
        error: response.error || 'Não foi possível sugerir hipóteses diagnósticas agora.',
        loading: false,
      }));
      return null;
    }

    setState({
      data: response.data,
      error: '',
      loading: false,
      generatedFor: signature,
    });
    return response.data;
  }, [onProfileUpdate, structuredText, templateId]);

  return {
    ...state,
    // Editar o texto organizado não apaga mais as hipóteses; apenas sinaliza
    // que elas se referem a uma versão anterior do texto.
    isStale: Boolean(state.data) && state.generatedFor !== currentSignature,
    generate,
    reset,
  };
}
