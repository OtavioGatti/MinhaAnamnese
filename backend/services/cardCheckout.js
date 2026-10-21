// Assinatura mensal com o cartão digitado na nossa página (Card Payment Brick
// do Mercado Pago). O cartão vira um token no navegador — o número nunca passa
// por aqui — e a assinatura já nasce "authorized", sem mandar a pessoa para a
// página do Mercado Pago, que exige login ou conta MP para autorizar o débito
// recorrente. Era ali que as assinaturas ficavam paradas em "pending".
//
// A recorrência é a mesma do fluxo antigo: /preapproval, as mesmas novas
// tentativas do Mercado Pago, o mesmo webhook liberando o acesso.

// Chave de desligar sem deploy: sem CARD_CHECKOUT_ENABLED=true no servidor o
// caminho novo recusa e o frontend volta para o checkout antigo.
function isCardCheckoutEnabled() {
  return process.env.CARD_CHECKOUT_ENABLED === 'true';
}

// O card token do Mercado Pago é um identificador curto; qualquer outra coisa
// nem vai para o provedor.
function normalizeCardToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{8,128}$/.test(token) ? token : null;
}

// Identificação do aparelho gerada pelo script de segurança do Mercado Pago no
// navegador (MP_DEVICE_SESSION_ID). Vai no header X-meli-session-id e é o que
// o antifraude usa para reconhecer o aparelho; sem ela toda compra parece vir
// de um aparelho desconhecido. Opcional: sem ela o pagamento segue igual.
function normalizeDeviceId(value) {
  const deviceId = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9._:-]{8,256}$/.test(deviceId) ? deviceId : null;
}

function buildDeviceHeaders(deviceId) {
  return deviceId ? { 'X-meli-session-id': deviceId } : {};
}

const MOTIVOS_DO_PROVEDOR = [
  {
    // Débito, pré-pago e alguns cartões que o emissor não libera para cobrança
    // recorrente.
    pattern: /unsupported_credit_card_for_recurring|invalid_payment_method/i,
    code: 'CARD_NOT_RECURRING',
    error: 'Este cartão não aceita cobrança mensal automática. Use um cartão de crédito.',
  },
  {
    // A cobrança de validação (valor mínimo, devolvido em seguida) foi negada.
    pattern: /cc_val|validation has failed|rejected|declined/i,
    // A recusa pode ser do banco ou do antifraude do Mercado Pago
    // (cc_rejected_high_risk, que só chega depois, pelo webhook): o texto não
    // culpa o banco, e a tela oferece a página do Mercado Pago, onde a pessoa
    // entra com a conta dela e a aprovação costuma ser maior (caso real de
    // 21/10/2026: duas tentativas com o mesmo cartão e desistência).
    code: 'CARD_DECLINED',
    error: 'O cartão não foi aprovado. Tente pagar pela página do Mercado Pago, onde a aprovação costuma ser maior, ou use outro cartão.',
  },
  {
    // O token vale uma vez só e expira: basta digitar de novo.
    pattern: /card_token|card token|token/i,
    code: 'CARD_TOKEN_INVALID',
    error: 'Os dados do cartão expiraram. Digite o cartão de novo.',
  },
];

// Traduz a recusa do Mercado Pago na criação da assinatura. Recusa do
// provedor (4xx) é sobre o cartão; erro 5xx é instabilidade dele.
function describeCardSubscriptionFailure({ providerStatus, providerMessage, providerCode } = {}) {
  if (!providerStatus || providerStatus >= 500) {
    return {
      statusCode: 502,
      code: 'PROVIDER_UNAVAILABLE',
      error: 'O Mercado Pago não respondeu agora. Nenhuma cobrança foi feita; tente de novo em instantes.',
    };
  }

  const texto = `${providerCode || ''} ${providerMessage || ''}`;
  const motivo = MOTIVOS_DO_PROVEDOR.find((item) => item.pattern.test(texto));

  return {
    statusCode: 422,
    code: motivo?.code || 'CARD_NOT_ACCEPTED',
    error: motivo?.error || 'Não foi possível confirmar este cartão. Confira os dados ou use outro cartão.',
  };
}

// --- semestral na nossa página (pagamento avulso, cartão ou Pix) --------------
//
// O semestral é pagamento único: não passa pelo /preapproval. O formulário é o
// Payment Brick do Mercado Pago (cartão ou Pix) e o pedido é criado na Orders
// API, numa aplicação do Mercado Pago só para isso (services/mercadoPagoOrders.js).

// Chave própria: dá para desligar o semestral sem mexer no mensal.
function isSemiannualPageCheckoutEnabled() {
  return process.env.SEMIANNUAL_PAGE_CHECKOUT_ENABLED === 'true';
}

// Pagamento criado pelo checkout na página: a pessoa já viu o resultado na
// tela, então o e-mail de recusa não sai (ela pode ter trocado de cartão e
// pago no minuto seguinte).
function isOnPagePayment(payment) {
  const flag = payment?.metadata?.checkout_na_pagina;
  return flag === true || flag === 'true';
}

module.exports = {
  buildDeviceHeaders,
  describeCardSubscriptionFailure,
  isCardCheckoutEnabled,
  isOnPagePayment,
  isSemiannualPageCheckoutEnabled,
  normalizeCardToken,
  normalizeDeviceId,
};
