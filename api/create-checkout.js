const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/checkout/preferences';
const PLAN_PRICE = 19.9;
const PLAN_TITLE = 'Plano Profissional';

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || 'https';
  const host = req.headers.host;

  return `${protocol}://${host}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({
      success: false,
      error: 'Pagamento indisponível no momento',
    });
  }

  const { userId, email } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Usuário inválido',
    });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'E-mail inválido',
    });
  }

  const baseUrl = getBaseUrl(req);

  try {
    const response = await fetch(MERCADO_PAGO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: PLAN_TITLE,
            quantity: 1,
            unit_price: PLAN_PRICE,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email,
        },
        metadata: {
          userId,
          email,
        },
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
        back_urls: {
          success: `${baseUrl}/?checkout=success`,
          pending: `${baseUrl}/?checkout=pending`,
          failure: `${baseUrl}/?checkout=failure`,
        },
        auto_return: 'approved',
      }),
    });

    if (!response.ok) {
      throw new Error('Mercado Pago preference request failed');
    }

    const json = await response.json();
    const checkoutUrl = json?.init_point;

    if (!checkoutUrl) {
      throw new Error('Missing init_point');
    }

    return res.status(200).json({
      success: true,
      data: {
        init_point: checkoutUrl,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      error: 'Não foi possível iniciar o pagamento',
    });
  }
};
