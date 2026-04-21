const crypto = require('crypto');
const { isValidUserId } = require('../../backend/utils/idValidation');
const {
  getBillingPaymentByPaymentId,
  upsertBillingPayment,
} = require('../../backend/services/billingPayments');
const { upsertProfile } = require('../../backend/services/profiles');

const MERCADO_PAGO_PAYMENT_API = 'https://api.mercadopago.com/v1/payments';
const PLAN_PRICE = 9.9;
const PLAN_CURRENCY = 'BRL';
const PLAN_PRODUCT = 'professional_plan';
const DEBUG_BILLING = process.env.DEBUG_BILLING === 'true';

function logBillingError(message, context = {}) {
  if (!DEBUG_BILLING) {
    return;
  }

  console.error('billing:', message, context);
}

function getMercadoPagoToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

function getMercadoPagoWebhookSecret() {
  return (
    process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
    process.env.MP_WEBHOOK_SECRET ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET
  );
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function parseMercadoPagoSignature(signatureHeader) {
  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    return {
      ts: '',
      v1: '',
    };
  }

  return signatureHeader
    .split(',')
    .map((part) => part.trim())
    .reduce(
      (accumulator, part) => {
        const [key, value] = part.split('=');

        if (!key || !value) {
          return accumulator;
        }

        accumulator[key.trim()] = value.trim();
        return accumulator;
      },
      { ts: '', v1: '' },
    );
}

function getPaymentId(req) {
  const body = req.body || {};
  const query = req.query || {};

  return (
    body?.data?.id ||
    body?.resource?.id ||
    body?.id ||
    query['data.id'] ||
    query.id ||
    null
  );
}

function isMercadoPagoWebhookSignatureValid(req, paymentId) {
  const secret = getMercadoPagoWebhookSecret();

  if (!secret) {
    return {
      valid: true,
      enforced: false,
    };
  }

  const signatureHeader =
    req.headers['x-signature'] ||
    req.headers['X-Signature'] ||
    '';
  const requestId =
    req.headers['x-request-id'] ||
    req.headers['X-Request-Id'] ||
    '';
  const { ts, v1 } = parseMercadoPagoSignature(signatureHeader);

  if (!paymentId || !requestId || !ts || !v1) {
    return {
      valid: false,
      enforced: true,
    };
  }

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const actual = String(v1).toLowerCase();
  const normalizedExpected = String(expected).toLowerCase();

  if (actual.length !== normalizedExpected.length) {
    return {
      valid: false,
      enforced: true,
    };
  }

  return {
    valid: crypto.timingSafeEqual(
      Buffer.from(actual),
      Buffer.from(normalizedExpected),
    ),
    enforced: true,
  };
}

async function getPaymentDetails(paymentId, accessToken) {
  const response = await fetch(`${MERCADO_PAGO_PAYMENT_API}/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch payment');
  }

  return response.json();
}

async function getSupabaseUserById(userId, { url, serviceRoleKey }) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch user by id');
  }

  return response.json();
}

function normalizeBillingMetadata(currentMetadata, payment) {
  return {
    ...(currentMetadata || {}),
    last_payment_id: String(payment.id),
    last_payment_status: payment.status || null,
    last_approved_at: payment.date_approved || null,
    last_transaction_amount: Number(payment.transaction_amount) || null,
    last_currency_id: payment.currency_id || null,
    product: PLAN_PRODUCT,
  };
}

async function updateSupabaseUserPlan(userId, currentMetadata, payment, { url, serviceRoleKey }) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      user_metadata: {
        ...(currentMetadata || {}),
        plan: 'pro',
        billing: normalizeBillingMetadata(currentMetadata?.billing, payment),
      },
    }),
  });

  if (!response.ok) {
    throw new Error('failed to update user plan');
  }
}

function hasExpectedAmount(payment) {
  const amount = Number(payment?.transaction_amount);
  return Number.isFinite(amount) && Math.abs(amount - PLAN_PRICE) < 0.0001;
}

function hasExpectedCurrency(payment) {
  return payment?.currency_id === PLAN_CURRENCY;
}

function hasExpectedProduct(payment) {
  return payment?.metadata?.product === PLAN_PRODUCT;
}

function isApprovedPlanPayment(payment) {
  return (
    payment?.status === 'approved' &&
    Boolean(payment?.date_approved) &&
    hasExpectedAmount(payment) &&
    hasExpectedCurrency(payment) &&
    hasExpectedProduct(payment)
  );
}

function getPaymentUserId(payment) {
  const candidate =
    payment?.metadata?.userId ||
    payment?.external_reference ||
    null;

  return isValidUserId(candidate) ? candidate : null;
}

async function persistPaymentSnapshot(payment, userId) {
  return upsertBillingPayment({
    paymentId: payment.id,
    userId,
    status: payment.status || 'unknown',
    amount: Number(payment.transaction_amount) || null,
    currencyId: payment.currency_id || null,
    product: payment?.metadata?.product || null,
    externalReference: payment.external_reference || null,
    payerEmail: payment?.metadata?.email || payment?.payer?.email || null,
    providerCreatedAt: payment.date_created || null,
    processedAt: null,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  const accessToken = getMercadoPagoToken();
  const supabase = getSupabaseConfig();

  if (!accessToken || !supabase.url || !supabase.serviceRoleKey) {
    return res.status(200).json({ success: true, skipped: true });
  }

  const paymentId = getPaymentId(req);

  if (!paymentId) {
    return res.status(200).json({ success: true });
  }

  const signatureCheck = isMercadoPagoWebhookSignatureValid(req, paymentId);

  if (!signatureCheck.valid) {
    logBillingError('invalid mercado pago webhook signature', {
      paymentId: String(paymentId),
      enforced: signatureCheck.enforced,
    });

    return res.status(401).json({ success: false });
  }

  try {
    const existingPayment = await getBillingPaymentByPaymentId(paymentId);

    if (existingPayment?.processed_at) {
      return res.status(200).json({ success: true, already_processed: true });
    }

    const payment = await getPaymentDetails(paymentId, accessToken);
    const userId = getPaymentUserId(payment);

    await persistPaymentSnapshot(payment, userId);

    if (!isApprovedPlanPayment(payment)) {
      return res.status(200).json({ success: true, skipped: true });
    }

    if (!userId) {
      logBillingError('payment missing deterministic user link', {
        paymentId: String(payment.id),
      });

      return res.status(200).json({ success: true, skipped: true });
    }

    const targetUser = await getSupabaseUserById(userId, supabase);

    if (!targetUser?.id) {
      throw new Error('user not found');
    }

    await updateSupabaseUserPlan(targetUser.id, targetUser.user_metadata, payment, supabase);
    await upsertProfile({
      id: targetUser.id,
      email: targetUser.email || payment?.payer?.email || null,
      current_plan: 'pro',
    });
    await upsertBillingPayment({
      paymentId: payment.id,
      userId: targetUser.id,
      status: payment.status || 'approved',
      amount: Number(payment.transaction_amount) || null,
      currencyId: payment.currency_id || null,
      product: payment?.metadata?.product || null,
      externalReference: payment.external_reference || null,
      payerEmail: payment?.metadata?.email || payment?.payer?.email || null,
      providerCreatedAt: payment.date_created || null,
      processedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    logBillingError('mercado pago webhook processing failed', {
      paymentId: String(paymentId),
      message: error?.message || 'unknown_error',
    });

    return res.status(500).json({ success: false });
  }
};
