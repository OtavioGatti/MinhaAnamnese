const crypto = require('crypto');

const MERCADO_PAGO_PAYMENT_API = 'https://api.mercadopago.com/v1/payments';

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

// Consulta o pagamento na Mercado Pago. Usado pelo cancelamento self-service
// para ler status e date_approved (janela de arrependimento) direto da fonte.
async function getMercadoPagoPayment(paymentId) {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    const error = new Error('mercado pago access token unavailable');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${MERCADO_PAGO_PAYMENT_API}/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('mercado pago payment fetch failed');
    error.statusCode = response.status === 404 ? 404 : 502;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

// Reembolso total do pagamento (body vazio = total). Idempotente do lado da MP
// via X-Idempotency-Key derivado do paymentId. Dispara também o webhook de
// 'refunded' de forma assíncrona (tratado pela mesma rota, com idempotência).
async function refundMercadoPagoPayment(paymentId) {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    const error = new Error('mercado pago access token unavailable');
    error.statusCode = 503;
    throw error;
  }

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`refund:${paymentId}`)
    .digest('hex');

  const response = await fetch(`${MERCADO_PAGO_PAYMENT_API}/${paymentId}/refunds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('mercado pago refund failed');
    error.statusCode = response.status === 401 || response.status === 403 ? 503 : 502;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

module.exports = {
  getMercadoPagoAccessToken,
  getMercadoPagoPayment,
  refundMercadoPagoPayment,
};
