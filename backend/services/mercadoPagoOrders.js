// Semestral pago na nossa página (cartão ou Pix), pela Orders API do Mercado
// Pago.
//
// É uma aplicação do Mercado Pago separada ("Checkout API"): a principal é de
// Checkout Pro + Assinaturas e não aceita pagamento criado pela nossa página
// (o tipo de uma aplicação não muda — confirmado pelo suporte em 23/09/2026).
// A Payments API legada também serviria, mas o próprio painel avisa que ela
// será descontinuada.
//
// A Orders API não aceita `metadata` (400 "additionalProperties '$.metadata'
// not allowed"), e é por ela que o webhook reconhece plano, dono e afiliado.
// Por isso: o pedido leva o id da conta em `external_reference`, e o pagamento
// que o Mercado Pago cria por baixo aponta para o pedido
// (point_of_interaction.references, tipo ORDER_MP). O webhook consulta o
// pedido, confere que é desta aplicação e reconstrói o metadata — o resto do
// fluxo (Pro, comissão, e-mail) segue igual ao do Checkout Pro.

const { getBillingPlan } = require('../config/billingPlans');
const { isValidUserId } = require('../utils/idValidation');

const ORDERS_URL = 'https://api.mercadopago.com/v1/orders';
const PAYMENTS_SEARCH_URL = 'https://api.mercadopago.com/v1/payments/search';
// Só o semestral é vendido por esta aplicação.
const PLANO_DOS_PEDIDOS = 'semiannual';
const VALIDADE_DO_PIX = 'PT30M';

function getOrdersAccessToken() {
  return process.env.MERCADO_PAGO_ORDERS_ACCESS_TOKEN || null;
}

// O número da aplicação vem no próprio token: APP_USR-<aplicação>-<data>-<hash>-<usuário>.
function getOrdersApplicationId(token = getOrdersAccessToken()) {
  const encontrado = /^(?:APP_USR|TEST)-(\d+)-/.exec(String(token || ''));
  return encontrado ? encontrado[1] : null;
}

function isOrdersConfigured() {
  return Boolean(getOrdersApplicationId());
}

function formatAmount(value) {
  return Number(value).toFixed(2);
}

/**
 * Pedido de pagamento avulso. Valor, dono e e-mail vêm do servidor; do
 * formulário só o meio de pagamento já validado (normalizeOrderPaymentInput).
 */
function buildOrderPayload({ userId, email, plan, chargeAmount, input }) {
  const amount = formatAmount(chargeAmount);
  const pagamento = input.kind === 'pix'
    ? { amount, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: VALIDADE_DO_PIX }
    : {
      amount,
      payment_method: {
        id: input.paymentMethodId,
        type: 'credit_card',
        token: input.token,
        installments: input.installments,
      },
    };

  return {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: amount,
    external_reference: userId,
    description: plan.title,
    payer: {
      email,
      ...(input.identification ? { identification: input.identification } : {}),
    },
    transactions: { payments: [pagamento] },
  };
}

function normalizeIdentification(raw) {
  const type = String(raw?.type || '').trim().toUpperCase();
  const number = String(raw?.number || '').replace(/\D/g, '');

  if ((type === 'CPF' && number.length === 11) || (type === 'CNPJ' && number.length === 14)) {
    return { type, number };
  }

  return null;
}

/**
 * Dados do formulário (Payment Brick): só formato. Valor, plano e dono nunca
 * vêm daqui. Devolve null se algo não confere.
 */
function normalizeOrderPaymentInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const paymentMethodId = typeof raw.paymentMethodId === 'string' ? raw.paymentMethodId.trim().toLowerCase() : '';
  const identification = normalizeIdentification(raw.identification);

  if (paymentMethodId === 'pix') {
    return { kind: 'pix', paymentMethodId, identification };
  }

  // Débito pela API pede autenticação do banco (3DS): fica de fora, como no mensal.
  if (!/^[a-z_]{2,30}$/.test(paymentMethodId) || raw.paymentTypeId !== 'credit_card') {
    return null;
  }

  const token = typeof raw.token === 'string' ? raw.token.trim() : '';
  const installments = Number(raw.installments);

  // À vista: parcelar na Orders API exige o valor do pedido já com os juros
  // (sandbox, 23/09/2026: 3x em R$ 129,90 voltou 400 "invalid_transaction_amount"),
  // e o webhook confere o valor do plano.
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token) || installments !== 1) {
    return null;
  }

  return { kind: 'cartao', paymentMethodId, token, installments, identification };
}

// O motivo da recusa no pedido vem sem o prefixo do formato antigo
// ("insufficient_amount" x "cc_rejected_insufficient_amount"), que é o que o
// tradutor de motivos conhece.
function normalizeOrderDeclineDetail(detail) {
  const codigo = String(detail || '').trim().toLowerCase();

  if (!codigo) {
    return null;
  }

  return codigo.startsWith('cc_') ? codigo : `cc_rejected_${codigo}`;
}

function getOrderPayment(order) {
  return order?.transactions?.payments?.[0] || null;
}

/**
 * O que responder ao navegador depois de criar o pedido. Recusado, a Orders
 * API responde 402 com o pedido dentro de `data`.
 * `processar` = aprovado: liberar o Pro agora, sem esperar o webhook.
 */
function describeOrderResponse(body, { describeDecline } = {}) {
  const order = body?.data?.id ? body.data : body;
  const pagamento = getOrderPayment(order);
  const status = String(order?.status || '').toLowerCase();
  const orderId = order?.id || null;

  if (status === 'processed') {
    return { statusCode: 200, processar: true, body: { success: true, data: { status: 'approved', order_id: orderId } } };
  }

  const pix = pagamento?.payment_method;

  if (status === 'action_required' && pix?.id === 'pix' && pix.qr_code) {
    return {
      statusCode: 200,
      processar: false,
      body: {
        success: true,
        data: {
          status: 'pending',
          order_id: orderId,
          pix: {
            qr_code: pix.qr_code,
            qr_code_base64: pix.qr_code_base64 || null,
            ticket_url: pix.ticket_url || null,
            expires_at: pagamento.date_of_expiration || null,
          },
        },
      },
    };
  }

  if (status === 'failed') {
    const detalhe = pagamento?.status_detail || order?.status_detail || null;
    const motivo = describeDecline ? describeDecline(normalizeOrderDeclineDetail(detalhe)) : null;

    return {
      statusCode: 422,
      processar: false,
      body: {
        success: false,
        code: 'CARD_DECLINED',
        error: motivo?.orientacao || 'O pagamento não foi aprovado. Confira os dados ou use outro cartão.',
        detalhe,
      },
    };
  }

  // Cartão em análise do banco ou antifraude: aprova ou recusa em minutos.
  if (['processing', 'created', 'action_required'].includes(status) && orderId) {
    return { statusCode: 200, processar: false, body: { success: true, data: { status: 'in_process', order_id: orderId } } };
  }

  // Status inesperado: não dá para garantir que nada foi cobrado.
  return {
    statusCode: 502,
    processar: false,
    body: {
      success: false,
      error: 'O Mercado Pago não confirmou o pagamento agora. Se a cobrança aparecer, o acesso é liberado automaticamente; se não, tente de novo em instantes.',
    },
  };
}

// Pagamento criado por baixo de um pedido desta aplicação.
function pickPaymentForOrder(payments = [], orderId) {
  const encontrado = payments.find((payment) => (payment?.point_of_interaction?.references || [])
    .some((ref) => ref?.type === 'ORDER_MP' && ref?.id === orderId));

  return encontrado?.id ? String(encontrado.id) : null;
}

function getOrderReference(payment) {
  const ref = (payment?.point_of_interaction?.references || []).find((item) => item?.type === 'ORDER_MP');
  return ref?.id || null;
}

/**
 * Metadata que o Checkout Pro mandaria, reconstruída a partir do pedido. Só
 * para pedido desta aplicação e com dono válido; senão, null (o pagamento
 * segue sem vínculo, como qualquer outro desconhecido).
 */
function buildOrderMetadata({ order, affiliate = null }) {
  if (!order || order.integration_data?.application_id !== getOrdersApplicationId()) {
    return null;
  }

  const userId = order.external_reference;

  if (!isValidUserId(userId)) {
    return null;
  }

  const plan = getBillingPlan(PLANO_DOS_PEDIDOS);
  const discountRate = Number(affiliate?.discount_rate) || 0;

  return {
    userId,
    user_id: userId,
    plan: 'pro',
    product: plan.product,
    plan_key: plan.key,
    plan_days: plan.days,
    billing_kind: plan.billingKind,
    affiliate_id: affiliate?.id || null,
    affiliate_code: affiliate?.code || null,
    discount_rate: discountRate > 0 ? discountRate : null,
    list_price: plan.price,
    checkout_na_pagina: true,
    order_id: order.id,
  };
}

// --- rede ---------------------------------------------------------------------

async function ordersRequest(method, url, { body, idempotencyKey } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getOrdersAccessToken()}`,
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await response.text();
  let json = null;

  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }

  return { status: response.status, json };
}

// Cria o pedido. Recusa do cartão (402) é resposta, não erro.
async function createOrder(payload, idempotencyKey) {
  const { status, json } = await ordersRequest('POST', ORDERS_URL, { body: payload, idempotencyKey });

  if (status === 201 || status === 200 || status === 402) {
    return json;
  }

  const erro = new Error('falha ao criar o pedido no Mercado Pago');
  erro.providerStatus = status;
  erro.providerMessage = json?.errors?.[0]?.message || json?.message || null;
  erro.providerCode = json?.errors?.[0]?.code || json?.error || null;
  throw erro;
}

async function getOrder(orderId) {
  const { status, json } = await ordersRequest('GET', `${ORDERS_URL}/${encodeURIComponent(orderId)}`);

  if (status !== 200 || !json?.id) {
    const erro = new Error('falha ao consultar o pedido no Mercado Pago');
    erro.providerStatus = status;
    throw erro;
  }

  return json;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O pagamento por baixo do pedido leva alguns segundos para aparecer na busca.
async function findOrderPaymentId(order, { tentativas = 3, esperaMs = 1500 } = {}) {
  const query = new URLSearchParams({
    external_reference: order.external_reference,
    sort: 'date_created',
    criteria: 'desc',
    limit: '20',
  });

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const { status, json } = await ordersRequest('GET', `${PAYMENTS_SEARCH_URL}?${query.toString()}`);
    const paymentId = status === 200 ? pickPaymentForOrder(json?.results || [], order.id) : null;

    if (paymentId) {
      return paymentId;
    }

    if (tentativa < tentativas) {
      await pause(esperaMs);
    }
  }

  return null;
}

module.exports = {
  PLANO_DOS_PEDIDOS,
  buildOrderMetadata,
  buildOrderPayload,
  createOrder,
  describeOrderResponse,
  findOrderPaymentId,
  getOrder,
  getOrderReference,
  getOrdersApplicationId,
  isOrdersConfigured,
  normalizeOrderDeclineDetail,
  normalizeOrderPaymentInput,
  pickPaymentForOrder,
};
