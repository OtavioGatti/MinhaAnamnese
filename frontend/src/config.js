// URL base da API - em dev usa proxy do Vite, em produção usa variável de ambiente
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const DIAGNOSTIC_HYPOTHESES_ENABLED =
  String(import.meta.env.VITE_DIAGNOSTIC_HYPOTHESES_ENABLED || 'true').toLowerCase() !== 'false';
