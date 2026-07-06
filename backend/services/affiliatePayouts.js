const { buildPayoutActionUrls } = require('../utils/payoutActionToken');

const DEFAULT_PAYOUT_MIN_AMOUNT = 50;
const PAYOUT_WEBHOOK_TIMEOUT_MS = 5000;

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getPayoutMinAmount() {
  const configured = Number(process.env.AFFILIATE_PAYOUT_MIN_AMOUNT);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_PAYOUT_MIN_AMOUNT;
}

function normalizePayout(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : null,
    affiliate_id: typeof record.affiliate_id === 'string' ? record.affiliate_id : null,
    amount: Number(record.amount) || 0,
    currency_id: typeof record.currency_id === 'string' ? record.currency_id : 'BRL',
    status: typeof record.status === 'string' ? record.status : 'requested',
    pix_key: typeof record.pix_key === 'string' ? record.pix_key : null,
    note: typeof record.note === 'string' ? record.note : null,
    requested_at: typeof record.requested_at === 'string' ? record.requested_at : null,
    paid_at: typeof record.paid_at === 'string' ? record.paid_at : null,
  };
}

async function supabaseRpc(functionName, payload) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('affiliate payout storage unavailable');
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('affiliate payout request failed');
  }

  return response.json();
}

function createPayoutError(result) {
  const error = new Error(result?.error || 'payout_request_failed');
  error.code = result?.error || 'payout_request_failed';
  error.details = result || null;
  return error;
}

async function requestAffiliatePayout({ affiliateId, pixKey }) {
  const result = await supabaseRpc('request_affiliate_payout', {
    p_affiliate_id: affiliateId,
    p_pix_key: pixKey || null,
    p_min_amount: getPayoutMinAmount(),
  });

  if (!result || result.ok !== true) {
    throw createPayoutError(result);
  }

  return normalizePayout(result.payout);
}

async function settleAffiliatePayout({ payoutId, action, note = null }) {
  const result = await supabaseRpc('settle_affiliate_payout', {
    p_payout_id: payoutId,
    p_action: action,
    p_note: note,
  });

  if (!result || result.ok !== true) {
    throw createPayoutError(result);
  }

  return normalizePayout(result.payout);
}

async function listAffiliatePayouts(affiliateId, limit = 20) {
  if (!affiliateId) {
    return [];
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('affiliate payout storage unavailable');
  }

  const query = new URLSearchParams({
    select: '*',
    affiliate_id: `eq.${affiliateId}`,
    order: 'requested_at.desc',
    limit: String(limit),
  });
  const response = await fetch(`${url}/rest/v1/affiliate_payouts?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('affiliate payout request failed');
  }

  const json = await response.json();
  return Array.isArray(json) ? json.map(normalizePayout).filter(Boolean) : [];
}

// Notificação (best-effort) para o dono via webhook externo (ex.: n8n ->
// WhatsApp/e-mail). A row no Supabase é a fonte da verdade: falha aqui não
// perde o pedido de saque.
async function notifyPayoutRequested({ payout, affiliate, baseUrl = null }) {
  const webhookUrl = process.env.AFFILIATE_PAYOUT_WEBHOOK_URL;

  if (!webhookUrl || !payout) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAYOUT_WEBHOOK_TIMEOUT_MS);
  // Links assinados de baixa direta (via WhatsApp); null se faltar segredo/URL.
  const actionUrls = buildPayoutActionUrls(payout.id, { baseUrl });

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'affiliate_payout_requested',
        payout_id: payout.id,
        affiliate_code: affiliate?.code || null,
        amount: payout.amount,
        currency_id: payout.currency_id,
        pix_key: payout.pix_key,
        requested_at: payout.requested_at,
        action_paid_url: actionUrls?.paid || null,
        action_rejected_url: actionUrls?.rejected || null,
      }),
      signal: controller.signal,
    });

    return true;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getPayoutMinAmount,
  listAffiliatePayouts,
  notifyPayoutRequested,
  requestAffiliatePayout,
  settleAffiliatePayout,
};
