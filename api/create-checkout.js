const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/checkout/preferences';
const PLAN_PRICE = 9.9;
const PLAN_TITLE = 'Plano Profissional';
const PLAN_PRODUCT = 'professional_plan';
const BILLING_VERSION = 'v1';
const PLAN_CURRENCY = 'BRL';
const DEBUG_CHECKOUT = process.env.DEBUG_CHECKOUT === 'true';
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

function logCheckoutError(message, context = {}) {
  if (!DEBUG_CHECKOUT) {
    return;
  }

  console.error('checkout:', message, context);
}

function getMercadoPagoAccessToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

function normalizeBaseUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  return rawValue.startsWith('http://') || rawValue.startsWith('https://')
    ? rawValue.replace(/\/+$/, '')
    : `https://${rawValue.replace(/\/+$/, '')}`;
}

function buildApiRouteUrl(baseUrl, routePath) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!normalizedBaseUrl) {
    return '';
  }

  const normalizedRoutePath = String(routePath || '').replace(/^\/+/, '');

  if (normalizedBaseUrl.endsWith('/api')) {
    return `${normalizedBaseUrl}/${normalizedRoutePath.replace(/^api\//, '')}`;
  }

  return `${normalizedBaseUrl}/${normalizedRoutePath}`;
}

function getConfiguredAppBaseUrl() {
  return normalizeBaseUrl(
    process.env.PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL,
  );
}

function getConfiguredApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.PUBLIC_API_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_BASE_URL ||
      process.env.VITE_API_URL,
  );
}

function getBaseUrl(req) {
  const configuredBaseUrl = getConfiguredAppBaseUrl();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const host = req.headers.host || '';

  if (host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
    return 'http://localhost:3000';
  }

  const protocol = forwardedProto || 'https';
  return host ? `${protocol}://${host}` : '';
}

function getWebhookUrl(req) {
  const configuredWebhookUrl = normalizeBaseUrl(process.env.MERCADO_PAGO_WEBHOOK_URL);

  if (configuredWebhookUrl) {
    return configuredWebhookUrl;
  }

  const configuredApiBaseUrl = getConfiguredApiBaseUrl();

  if (configuredApiBaseUrl) {
    return buildApiRouteUrl(configuredApiBaseUrl, 'api/webhook/mercadopago');
  }

  return buildApiRouteUrl(getBaseUrl(req), 'api/webhook/mercadopago');
}

function getMissingCheckoutConfigKeys() {
  const missing = [];

  if (!getMercadoPagoAccessToken()) {
    missing.push('MERCADO_PAGO_ACCESS_TOKEN');
  }

  if (!getConfiguredAppBaseUrl()) {
    missing.push('PUBLIC_APP_URL');
  }

  return missing;
}

function createConfigError(message) {
  const error = new Error(message);
  error.code = 'CHECKOUT_CONFIG_ERROR';
  return error;
}

function getCheckoutBaseUrl(req) {
  const baseUrl = getBaseUrl(req);

  if (!baseUrl) {
    throw createConfigError(
      'Checkout indisponível: configure PUBLIC_APP_URL ou APP_BASE_URL no servidor.',
    );
  }

  return baseUrl;
}

function buildCheckoutPayload({ baseUrl, webhookUrl, email, userId }) {
  return {
    items: [
      {
        title: PLAN_TITLE,
        quantity: 1,
        unit_price: PLAN_PRICE,
        currency_id: PLAN_CURRENCY,
      },
    ],
    payer: {
      email,
    },
    metadata: {
      userId,
      email,
      plan: 'pro',
      product: PLAN_PRODUCT,
      billing_version: BILLING_VERSION,
    },
    external_reference: userId,
    notification_url: webhookUrl,
    back_urls: {
      success: `${baseUrl}/?checkout=success`,
      pending: `${baseUrl}/?checkout=pending`,
      failure: `${baseUrl}/?checkout=failure`,
    },
    auto_return: 'approved',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const missingConfigKeys = getMissingCheckoutConfigKeys();

  if (missingConfigKeys.length > 0) {
    return res.status(503).json({
      success: false,
      error: `Checkout indisponível: configure ${missingConfigKeys.join(' e ')} no Render.`,
    });
  }

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({
        success: false,
        error: auth.error,
      });
    }

    const userId = auth.user.id;
    const email = auth.user.email;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'E-mail inválido para iniciar o checkout.',
      });
    }

    const payload = buildCheckoutPayload({
      baseUrl: getCheckoutBaseUrl(req),
      webhookUrl: getWebhookUrl(req),
      email,
      userId,
    });

    const response = await fetch(MERCADO_PAGO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401 || response.status === 403) {
      logCheckoutError('mercado pago auth failed', {
        status: response.status,
        userId,
      });

      return res.status(503).json({
        success: false,
        error: 'Checkout indisponível: token do Mercado Pago ausente ou inválido no servidor.',
      });
    }

    if (!response.ok) {
      const providerBody = await response.text();

      logCheckoutError('mercado pago preference request failed', {
        status: response.status,
        userId,
        providerBody,
      });

      return res.status(502).json({
        success: false,
        error: 'Não foi possível iniciar o checkout com o provedor de pagamento.',
      });
    }

    const json = await response.json();
    const checkoutUrl = json?.init_point;

    if (!checkoutUrl) {
      logCheckoutError('mercado pago missing init_point', {
        userId,
        responseKeys: json && typeof json === 'object' ? Object.keys(json) : [],
      });

      return res.status(502).json({
        success: false,
        error: 'O provedor de pagamento não retornou um link de checkout válido.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        init_point: checkoutUrl,
      },
    });
  } catch (error) {
    if (error?.code === 'CHECKOUT_CONFIG_ERROR') {
      return res.status(503).json({
        success: false,
        error: error.message,
      });
    }

    logCheckoutError('unexpected create-checkout failure', {
      message: error?.message || 'unknown_error',
    });

    return res.status(500).json({
      success: false,
      error: 'Não foi possível iniciar o pagamento no momento.',
    });
  }
};
