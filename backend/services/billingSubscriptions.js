const { isValidUserId } = require('../utils/idValidation');

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function normalizeSubscriptionRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : null,
    preapproval_id: record.preapproval_id != null ? String(record.preapproval_id) : null,
    user_id: typeof record.user_id === 'string' ? record.user_id : null,
    status: typeof record.status === 'string' ? record.status : null,
    plan_key: typeof record.plan_key === 'string' ? record.plan_key : null,
    amount: typeof record.amount === 'number' ? record.amount : null,
    currency_id: typeof record.currency_id === 'string' ? record.currency_id : null,
    payer_email: typeof record.payer_email === 'string' ? record.payer_email : null,
    external_reference: typeof record.external_reference === 'string' ? record.external_reference : null,
    next_payment_date: typeof record.next_payment_date === 'string' ? record.next_payment_date : null,
    affiliate_id: typeof record.affiliate_id === 'string' ? record.affiliate_id : null,
    affiliate_code: typeof record.affiliate_code === 'string' ? record.affiliate_code : null,
    provider_created_at: typeof record.provider_created_at === 'string' ? record.provider_created_at : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

async function getBillingSubscriptionByPreapprovalId(preapprovalId) {
  const normalizedPreapprovalId = preapprovalId != null ? String(preapprovalId) : '';

  if (!normalizedPreapprovalId) {
    return null;
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('billing subscription storage unavailable');
  }

  const query = new URLSearchParams({
    select: '*',
    preapproval_id: `eq.${normalizedPreapprovalId}`,
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/billing_subscriptions?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch billing subscription');
  }

  const json = await response.json();
  return Array.isArray(json) && json.length ? normalizeSubscriptionRecord(json[0]) : null;
}

/**
 * Assinatura recorrente ATIVA de um usuário (status='authorized' na Mercado
 * Pago), a mais recente se houver mais de uma histórica. Usada para
 * cancelamento self-service — nunca aceita um preapproval_id vindo do
 * cliente, sempre resolve pelo user_id da sessão autenticada.
 */
async function getActiveBillingSubscriptionByUserId(userId) {
  if (!isValidUserId(userId)) {
    return null;
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('billing subscription storage unavailable');
  }

  const query = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    status: 'eq.authorized',
    order: 'created_at.desc',
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/billing_subscriptions?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch active billing subscription');
  }

  const json = await response.json();
  return Array.isArray(json) && json.length ? normalizeSubscriptionRecord(json[0]) : null;
}

async function upsertBillingSubscription({
  preapprovalId,
  userId,
  status,
  planKey,
  amount,
  currencyId,
  payerEmail,
  externalReference,
  nextPaymentDate,
  affiliateId,
  affiliateCode,
  providerCreatedAt,
}) {
  const normalizedPreapprovalId = preapprovalId != null ? String(preapprovalId) : '';

  if (!normalizedPreapprovalId) {
    throw new Error('preapproval id required');
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('billing subscription storage unavailable');
  }

  const payload = {
    preapproval_id: normalizedPreapprovalId,
    user_id: isValidUserId(userId) ? userId : null,
    status: status || 'pending',
    plan_key: planKey || 'monthly',
    amount: typeof amount === 'number' && !Number.isNaN(amount) ? amount : null,
    currency_id: currencyId || null,
    payer_email: payerEmail || null,
    external_reference: externalReference || null,
    next_payment_date: nextPaymentDate || null,
    affiliate_id: affiliateId || null,
    affiliate_code: affiliateCode || null,
    provider_created_at: providerCreatedAt || null,
  };

  const query = new URLSearchParams({
    on_conflict: 'preapproval_id',
  });

  const response = await fetch(`${url}/rest/v1/billing_subscriptions?${query.toString()}`, {
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
    throw new Error('failed to upsert billing subscription');
  }

  const json = await response.json();
  return normalizeSubscriptionRecord(Array.isArray(json) ? json[0] : null);
}

module.exports = {
  getBillingSubscriptionByPreapprovalId,
  getActiveBillingSubscriptionByUserId,
  upsertBillingSubscription,
};
