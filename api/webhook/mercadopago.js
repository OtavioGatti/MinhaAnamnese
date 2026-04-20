const MERCADO_PAGO_PAYMENT_API = 'https://api.mercadopago.com/v1/payments';
const PLAN_PRICE = 9.9;
const PLAN_CURRENCY = 'BRL';
const PLAN_PRODUCT = 'professional_plan';

function getMercadoPagoToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
    throw new Error('Failed to fetch payment');
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
    throw new Error('Failed to fetch user by id');
  }

  return response.json();
}

async function getSupabaseUserByEmail(email, { url, serviceRoleKey }) {
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to list users');
  }

  const json = await response.json();
  const users = json?.users || [];

  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
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
    throw new Error('Failed to update user plan');
  }
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

function hasExpectedAmount(payment) {
  const amount = Number(payment?.transaction_amount);
  return Number.isFinite(amount) && Math.abs(amount - PLAN_PRICE) < 0.0001;
}

function hasExpectedCurrency(payment) {
  return payment?.currency_id === PLAN_CURRENCY;
}

function hasExpectedProduct(payment) {
  return payment?.metadata?.product === PLAN_PRODUCT || !payment?.metadata?.product;
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

function isAlreadyProcessed(targetUser, payment) {
  const currentPlan = targetUser?.user_metadata?.plan;
  const billing = targetUser?.user_metadata?.billing;

  return (
    currentPlan === 'pro' &&
    billing?.last_payment_id &&
    String(billing.last_payment_id) === String(payment.id)
  );
}

function getPaymentUserId(payment) {
  return (
    payment?.metadata?.userId ||
    payment?.external_reference ||
    null
  );
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

  try {
    const payment = await getPaymentDetails(paymentId, accessToken);

    if (!isApprovedPlanPayment(payment)) {
      return res.status(200).json({ success: true });
    }

    const userId = getPaymentUserId(payment);
    const email = payment?.metadata?.email || payment?.payer?.email;

    let targetUser = null;

    if (userId) {
      targetUser = await getSupabaseUserById(userId, supabase);
    } else if (email) {
      targetUser = await getSupabaseUserByEmail(email, supabase);
    }

    if (!targetUser?.id) {
      throw new Error('User not found');
    }

    if (isAlreadyProcessed(targetUser, payment)) {
      return res.status(200).json({ success: true, already_processed: true });
    }

    await updateSupabaseUserPlan(targetUser.id, targetUser.user_metadata, payment, supabase);

    return res.status(200).json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false });
  }
};
