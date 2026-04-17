const MERCADO_PAGO_PAYMENT_API = 'https://api.mercadopago.com/v1/payments';
const PLAN_PRICE = 9.9;

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

async function updateSupabaseUserPlan(userId, currentMetadata, { url, serviceRoleKey }) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  const accessToken = getMercadoPagoToken();
  const supabase = getSupabaseConfig();

  if (!accessToken || !supabase.url || !supabase.serviceRoleKey) {
    return res.status(500).json({ success: false });
  }

  const paymentId = getPaymentId(req);

  if (!paymentId) {
    return res.status(200).json({ success: true });
  }

  try {
    const payment = await getPaymentDetails(paymentId, accessToken);

    const isApproved = payment?.status === 'approved';
    const hasApprovedDate = Boolean(payment?.date_approved);
    const hasExpectedAmount = Number(payment?.transaction_amount) === PLAN_PRICE;

    if (!isApproved || !hasApprovedDate || !hasExpectedAmount) {
      return res.status(200).json({ success: true });
    }

    const userId = payment.metadata?.userId;
    const email = payment.metadata?.email || payment.payer?.email;

    let targetUser = null;

    if (userId) {
      targetUser = await getSupabaseUserById(userId, supabase);
    } else if (email) {
      targetUser = await getSupabaseUserByEmail(email, supabase);
    }

    if (!targetUser?.id) {
      throw new Error('User not found');
    }

    await updateSupabaseUserPlan(targetUser.id, targetUser.user_metadata, supabase);

    return res.status(200).json({ success: true });
  } catch (_error) {
    return res.status(500).json({ success: false });
  }
};
