const { isValidUserId } = require('../utils/idValidation');

function getSupabaseAdminConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    serviceRoleKey,
  };
}

function normalizePaymentRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : null,
    payment_id: record.payment_id != null ? String(record.payment_id) : null,
    user_id: typeof record.user_id === 'string' ? record.user_id : null,
    status: typeof record.status === 'string' ? record.status : null,
    amount: typeof record.amount === 'number' ? record.amount : null,
    currency_id: typeof record.currency_id === 'string' ? record.currency_id : null,
    product: typeof record.product === 'string' ? record.product : null,
    external_reference: typeof record.external_reference === 'string' ? record.external_reference : null,
    payer_email: typeof record.payer_email === 'string' ? record.payer_email : null,
    provider_created_at: typeof record.provider_created_at === 'string' ? record.provider_created_at : null,
    processed_at: typeof record.processed_at === 'string' ? record.processed_at : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

async function getBillingPaymentByPaymentId(paymentId) {
  const normalizedPaymentId = paymentId != null ? String(paymentId) : '';

  if (!normalizedPaymentId) {
    return null;
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('billing storage unavailable');
  }

  const query = new URLSearchParams({
    select: '*',
    payment_id: `eq.${normalizedPaymentId}`,
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/billing_payments?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch billing payment');
  }

  const json = await response.json();

  if (!Array.isArray(json) || json.length === 0) {
    return null;
  }

  return normalizePaymentRecord(json[0]);
}

async function upsertBillingPayment({
  paymentId,
  userId,
  status,
  amount,
  currencyId,
  product,
  externalReference,
  payerEmail,
  providerCreatedAt,
  processedAt = null,
}) {
  const normalizedPaymentId = paymentId != null ? String(paymentId) : '';

  if (!normalizedPaymentId) {
    throw new Error('billing payment id required');
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('billing storage unavailable');
  }

  const payload = {
    payment_id: normalizedPaymentId,
    user_id: isValidUserId(userId) ? userId : null,
    status: status || null,
    amount: typeof amount === 'number' && !Number.isNaN(amount) ? amount : null,
    currency_id: currencyId || null,
    product: product || null,
    external_reference: externalReference || null,
    payer_email: payerEmail || null,
    provider_created_at: providerCreatedAt || null,
    processed_at: processedAt,
  };

  const query = new URLSearchParams({
    on_conflict: 'payment_id',
  });

  const response = await fetch(`${url}/rest/v1/billing_payments?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('failed to upsert billing payment');
  }

  const json = await response.json();
  const record = Array.isArray(json) ? json[0] : null;
  return normalizePaymentRecord(record);
}

module.exports = {
  getBillingPaymentByPaymentId,
  upsertBillingPayment,
};
