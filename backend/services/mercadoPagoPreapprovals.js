const MERCADO_PAGO_PREAPPROVAL_API = 'https://api.mercadopago.com/preapproval';

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

// Cancela a assinatura (preapproval) no Mercado Pago. Usado pelo cancelamento
// self-service e pelo cancelamento automático em reembolso/chargeback.
async function cancelMercadoPagoPreapproval(preapprovalId) {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    const error = new Error('mercado pago access token unavailable');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${MERCADO_PAGO_PREAPPROVAL_API}/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('mercado pago preapproval cancel failed');
    error.statusCode = response.status === 401 || response.status === 403 ? 503 : 502;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

module.exports = {
  cancelMercadoPagoPreapproval,
  getMercadoPagoAccessToken,
};
