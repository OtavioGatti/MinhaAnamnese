// URL base da API - em dev usa proxy do Vite, em produção usa variável de ambiente
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
// Fallback opcional (ex.: '/api' servido pelas functions da Vercel) usado apenas
// em rotas GET de leitura quando o backend primário está inacessível.
// Sem VITE_API_FALLBACK_URL configurada, nada muda no comportamento.
export const API_FALLBACK_URL = import.meta.env.VITE_API_FALLBACK_URL || '';
export const DIAGNOSTIC_HYPOTHESES_ENABLED =
  String(import.meta.env.VITE_DIAGNOSTIC_HYPOTHESES_ENABLED || 'true').toLowerCase() !== 'false';
// Assinatura mensal com o cartão digitado na nossa página (sem ir ao Mercado
// Pago). "on" liga para todos; sem isso só liga no navegador aberto com
// ?checkout_cartao=1. A chave pública do Mercado Pago é pública por natureza.
export const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || '';
export const CARD_CHECKOUT_FLAG = String(import.meta.env.VITE_CARD_CHECKOUT || '').toLowerCase();
// Semestral pago aqui (cartão à vista ou Pix), pela aplicação do Mercado Pago
// só do semestral. "on" liga para todos; ?checkout_cartao=1 liga neste navegador.
export const MERCADO_PAGO_ORDERS_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_ORDERS_PUBLIC_KEY || '';
export const SEMIANNUAL_PAGE_CHECKOUT_FLAG = String(import.meta.env.VITE_SEMIANNUAL_PAGE_CHECKOUT || '').toLowerCase();
