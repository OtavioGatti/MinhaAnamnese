// URL base da API - em dev usa proxy do Vite, em produção usa variável de ambiente
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
// Fallback opcional (ex.: '/api' servido pelas functions da Vercel) usado apenas
// em rotas GET de leitura quando o backend primário está inacessível.
// Sem VITE_API_FALLBACK_URL configurada, nada muda no comportamento.
export const API_FALLBACK_URL = import.meta.env.VITE_API_FALLBACK_URL || '';
export const DIAGNOSTIC_HYPOTHESES_ENABLED =
  String(import.meta.env.VITE_DIAGNOSTIC_HYPOTHESES_ENABLED || 'true').toLowerCase() !== 'false';
