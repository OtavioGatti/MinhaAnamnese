// URL base da API - em dev usa proxy do Vite, em produção usa variável de ambiente
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
