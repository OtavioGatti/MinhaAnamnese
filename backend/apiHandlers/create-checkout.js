const MERCADO_PAGO_PREFERENCES_URL = 'https://api.mercadopago.com/checkout/preferences';
const MERCADO_PAGO_PREAPPROVAL_URL = 'https://api.mercadopago.com/preapproval';
const BILLING_VERSION = 'v2';
const DEBUG_CHECKOUT = process.env.DEBUG_CHECKOUT === 'true';
const {
  DEFAULT_PLAN_KEY,
  getBillingPlan,
  normalizePlanKey,
} = require('../config/billingPlans');
const { resolveAffiliateForCheckout } = require('../services/affiliates');
const { upsertBillingSubscription } = require('../services/billingSubscriptions');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

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

function createProviderError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getCheckoutBaseUrl(req) {
  const baseUrl = getBaseUrl(req);

  if (!baseUrl) {
    throw createConfigError(
      'Checkout indisponivel: configure PUBLIC_APP_URL ou APP_BASE_URL no servidor.',
    );
  }

  return baseUrl;
}

function buildOneTimeCheckoutPayload({ baseUrl, webhookUrl, email, userId, plan, affiliate }) {
  return {
    items: [
      {
        title: plan.title,
        quantity: 1,
        unit_price: plan.price,
        currency_id: plan.currencyId,
      },
    ],
    payer: {
      email,
    },
    metadata: {
      userId,
      user_id: userId,
      email,
      plan: 'pro',
      product: plan.product,
      plan_key: plan.key,
      plan_days: plan.days,
      billing_kind: plan.billingKind,
      billing_version: BILLING_VERSION,
      affiliate_id: affiliate?.id || null,
      affiliate_code: affiliate?.code || null,
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

function buildSubscriptionPayload({ baseUrl, email, userId, plan }) {
  return {
    reason: plan.reason,
    external_reference: userId,
    payer_email: email,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: plan.price,
      currency_id: plan.currencyId,
    },
    back_url: `${baseUrl}/?checkout=success`,
    status: 'pending',
  };
}

async function postMercadoPagoJson(url, payload, userId, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401 || response.status === 403) {
    logCheckoutError(`${label} auth failed`, {
      status: response.status,
      userId,
    });

    throw createProviderError(
      'Checkout indisponivel: token do Mercado Pago ausente ou invalido no servidor.',
      503,
    );
  }

  if (!response.ok) {
    const providerBody = await response.text();

    logCheckoutError(`${label} request failed`, {
      status: response.status,
      userId,
      providerBody,
    });

    throw createProviderError('Nao foi possivel iniciar o pagamento com o provedor.');
  }

  return response.json();
}

function getInitPointOrThrow(providerResponse, userId, label) {
  const checkoutUrl = providerResponse?.init_point;

  if (!checkoutUrl) {
    logCheckoutError(`${label} missing init_point`, {
      userId,
      responseKeys: providerResponse && typeof providerResponse === 'object'
        ? Object.keys(providerResponse)
        : [],
    });

    throw createProviderError('O provedor de pagamento nao retornou um link valido.');
  }

  return checkoutUrl;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido.',
    });
  }

  const missingConfigKeys = getMissingCheckoutConfigKeys();

  if (missingConfigKeys.length > 0) {
    return res.status(503).json({
      success: false,
      error: `Checkout indisponivel: configure ${missingConfigKeys.join(' e ')} no Render.`,
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
        error: 'E-mail invalido para iniciar o checkout.',
      });
    }

    const body = req.body || {};
    const plan = getBillingPlan(normalizePlanKey(body.planKey || DEFAULT_PLAN_KEY));
    const baseUrl = getCheckoutBaseUrl(req);
    const affiliate = body.affiliateCode
      ? await resolveAffiliateForCheckout({
        affiliateCode: body.affiliateCode,
        buyerUserId: userId,
        sourceUrl: body.sourceUrl,
      }).catch(() => null)
      : null;

    if (plan.billingKind === 'subscription') {
      const payload = buildSubscriptionPayload({
        baseUrl,
        email,
        userId,
        plan,
      });
      const providerResponse = await postMercadoPagoJson(
        MERCADO_PAGO_PREAPPROVAL_URL,
        payload,
        userId,
        'mercado pago preapproval',
      );
      const checkoutUrl = getInitPointOrThrow(providerResponse, userId, 'mercado pago preapproval');
      const preapprovalId = providerResponse?.id || null;

      if (preapprovalId) {
        await upsertBillingSubscription({
          preapprovalId,
          userId,
          status: providerResponse?.status || 'pending',
          planKey: plan.key,
          amount: plan.price,
          currencyId: plan.currencyId,
          payerEmail: email,
          externalReference: userId,
          nextPaymentDate: providerResponse?.next_payment_date || null,
          affiliateId: affiliate?.id || null,
          affiliateCode: affiliate?.code || null,
          providerCreatedAt: providerResponse?.date_created || null,
        }).catch((error) => {
          logCheckoutError('failed to persist preapproval snapshot', {
            userId,
            preapprovalId,
            message: error?.message || 'unknown_error',
          });
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          init_point: checkoutUrl,
          plan_key: plan.key,
          billing_kind: plan.billingKind,
        },
      });
    }

    const payload = buildOneTimeCheckoutPayload({
      baseUrl,
      webhookUrl: getWebhookUrl(req),
      email,
      userId,
      plan,
      affiliate,
    });
    const providerResponse = await postMercadoPagoJson(
      MERCADO_PAGO_PREFERENCES_URL,
      payload,
      userId,
      'mercado pago preference',
    );
    const checkoutUrl = getInitPointOrThrow(providerResponse, userId, 'mercado pago preference');

    return res.status(200).json({
      success: true,
      data: {
        init_point: checkoutUrl,
        plan_key: plan.key,
        billing_kind: plan.billingKind,
      },
    });
  } catch (error) {
    if (error?.code === 'CHECKOUT_CONFIG_ERROR') {
      return res.status(503).json({
        success: false,
        error: error.message,
      });
    }

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    logCheckoutError('unexpected create-checkout failure', {
      message: error?.message || 'unknown_error',
    });

    return res.status(500).json({
      success: false,
      error: 'Nao foi possivel iniciar o pagamento no momento.',
    });
  }
};
