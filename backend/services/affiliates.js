const { COMMISSION_RATE, calculateCommissionAmount, normalizeDiscountRate } = require('../config/billingPlans');
const { isValidUserId } = require('../utils/idValidation');

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function normalizeAffiliateCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeAffiliate(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : null,
    user_id: typeof record.user_id === 'string' ? record.user_id : null,
    code: typeof record.code === 'string' ? record.code : null,
    status: typeof record.status === 'string' ? record.status : 'paused',
    commission_rate: Number(record.commission_rate) || COMMISSION_RATE,
    // Colunas de desconto podem não existir antes do SQL ser aplicado: default 0.
    discount_rate: normalizeDiscountRate(record.discount_rate),
    discount_label: typeof record.discount_label === 'string' && record.discount_label.trim()
      ? record.discount_label.trim()
      : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

function normalizeCommission(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : null,
    affiliate_id: typeof record.affiliate_id === 'string' ? record.affiliate_id : null,
    buyer_user_id: typeof record.buyer_user_id === 'string' ? record.buyer_user_id : null,
    payment_id: record.payment_id != null ? String(record.payment_id) : null,
    plan_key: typeof record.plan_key === 'string' ? record.plan_key : null,
    billing_kind: typeof record.billing_kind === 'string' ? record.billing_kind : null,
    gross_amount: Number(record.gross_amount) || 0,
    commission_rate: Number(record.commission_rate) || COMMISSION_RATE,
    commission_amount: Number(record.commission_amount) || 0,
    currency_id: typeof record.currency_id === 'string' ? record.currency_id : 'BRL',
    status: typeof record.status === 'string' ? record.status : 'pending',
    payout_id: typeof record.payout_id === 'string' ? record.payout_id : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

function buildAffiliateCodeSeed(user) {
  const emailSeed = String(user?.email || '').split('@')[0];
  const nameSeed = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const normalizedSeed = normalizeAffiliateCode(emailSeed || nameSeed || 'afiliado');
  return normalizedSeed.length >= 3 ? normalizedSeed : `afiliado-${normalizedSeed || 'pro'}`;
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('affiliate storage unavailable');
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error('affiliate storage request failed');
  }

  return response;
}

async function getAffiliateByUserId(userId) {
  if (!isValidUserId(userId)) {
    return null;
  }

  const query = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await supabaseRequest(`affiliates?${query.toString()}`, { method: 'GET' });
  const json = await response.json();
  return Array.isArray(json) && json.length ? normalizeAffiliate(json[0]) : null;
}

async function getAffiliateByCode(code) {
  const normalizedCode = normalizeAffiliateCode(code);

  if (!normalizedCode) {
    return null;
  }

  const query = new URLSearchParams({
    select: '*',
    code: `eq.${normalizedCode}`,
    status: 'eq.active',
    limit: '1',
  });
  const response = await supabaseRequest(`affiliates?${query.toString()}`, { method: 'GET' });
  const json = await response.json();
  return Array.isArray(json) && json.length ? normalizeAffiliate(json[0]) : null;
}

async function createAffiliate(user) {
  if (!isValidUserId(user?.id)) {
    throw new Error('valid user required');
  }

  const existing = await getAffiliateByUserId(user.id);

  if (existing) {
    return existing;
  }

  const seed = buildAffiliateCodeSeed(user);
  let code = seed;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const payload = {
      user_id: user.id,
      code,
      status: 'active',
      commission_rate: COMMISSION_RATE,
    };

    const response = await fetch(`${getSupabaseAdminConfig().url}/rest/v1/affiliates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: getSupabaseAdminConfig().serviceRoleKey,
        Authorization: `Bearer ${getSupabaseAdminConfig().serviceRoleKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const json = await response.json();
      return normalizeAffiliate(Array.isArray(json) ? json[0] : null);
    }

    code = `${seed}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 48);
  }

  throw new Error('failed to create affiliate');
}

async function createAffiliateWithCode(user, requestedCode) {
  if (!isValidUserId(user?.id)) {
    throw new Error('valid user required');
  }

  const existing = await getAffiliateByUserId(user.id);

  if (existing) {
    return existing;
  }

  const code = normalizeAffiliateCode(requestedCode);

  if (code.length < 3) {
    const error = new Error('affiliate code too short');
    error.code = 'INVALID_AFFILIATE_CODE';
    throw error;
  }

  const payload = {
    user_id: user.id,
    code,
    status: 'active',
    commission_rate: COMMISSION_RATE,
  };
  const response = await fetch(`${getSupabaseAdminConfig().url}/rest/v1/affiliates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: getSupabaseAdminConfig().serviceRoleKey,
      Authorization: `Bearer ${getSupabaseAdminConfig().serviceRoleKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    const error = new Error('affiliate code already exists');
    error.code = 'AFFILIATE_CODE_TAKEN';
    throw error;
  }

  if (!response.ok) {
    throw new Error('failed to create affiliate');
  }

  const json = await response.json();
  return normalizeAffiliate(Array.isArray(json) ? json[0] : null);
}

async function createAffiliateAttribution({ affiliate, buyerUserId, sourceUrl }) {
  if (!affiliate?.id || !isValidUserId(buyerUserId)) {
    return null;
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    affiliate_id: affiliate.id,
    buyer_user_id: buyerUserId,
    affiliate_code: affiliate.code,
    source_url: sourceUrl || null,
    expires_at: expiresAt,
  };

  const response = await supabaseRequest('affiliate_attributions', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  return Array.isArray(json) ? json[0] : null;
}

async function resolveAffiliateForCheckout({ affiliateCode, buyerUserId, sourceUrl }) {
  const affiliate = await getAffiliateByCode(affiliateCode);

  if (!affiliate || affiliate.status !== 'active') {
    return null;
  }

  if (affiliate.user_id === buyerUserId) {
    return null;
  }

  await createAffiliateAttribution({ affiliate, buyerUserId, sourceUrl }).catch(() => null);
  return affiliate;
}

function emptyAffiliateStats() {
  return {
    totalCommission: 0,
    pendingCommission: 0,
    paidCommission: 0,
    availableCommission: 0,
    processingCommission: 0,
    conversions: 0,
  };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Blindagem: o saldo é derivado do status REAL do saque de cada comissão, não
// só da presença de payout_id. Assim, um saque rejeitado/pago por edição manual
// (fora do RPC) não deixa dinheiro preso nem re-sacável indevidamente.
//   - disponível: pending/approved sem saque ou com saque rejeitado
//   - em processamento: comissão em um saque ainda 'requested'
//   - comissão presa em saque 'paid' sem baixa correta não entra em disponível
//     (evita saque em dobro) — precisa ser corrigida pelo RPC settle.
function summarizeAffiliateCommissions(commissions = [], payoutStatusById = new Map()) {
  const summary = commissions.reduce((accumulator, commission) => {
    const amount = Number(commission.commission_amount) || 0;
    accumulator.totalCommission += amount;
    accumulator.conversions += 1;

    if (commission.status === 'paid') {
      accumulator.paidCommission += amount;
      return accumulator;
    }

    if (commission.status === 'cancelled') {
      return accumulator;
    }

    accumulator.pendingCommission += amount;

    const payoutStatus = commission.payout_id ? payoutStatusById.get(commission.payout_id) : null;

    if (payoutStatus === 'requested') {
      accumulator.processingCommission += amount;
    } else if (!commission.payout_id || payoutStatus === 'rejected') {
      accumulator.availableCommission += amount;
    }

    return accumulator;
  }, emptyAffiliateStats());

  summary.totalCommission = roundMoney(summary.totalCommission);
  summary.pendingCommission = roundMoney(summary.pendingCommission);
  summary.paidCommission = roundMoney(summary.paidCommission);
  summary.availableCommission = roundMoney(summary.availableCommission);
  summary.processingCommission = roundMoney(summary.processingCommission);

  return summary;
}

// Best-effort: se a tabela de saques ainda não existir, retorna mapa vazio e o
// saldo cai no comportamento anterior (tudo pending/approved = disponível).
async function getAffiliatePayoutStatusMap(affiliateId) {
  try {
    const query = new URLSearchParams({
      select: 'id,status',
      affiliate_id: `eq.${affiliateId}`,
    });
    const response = await supabaseRequest(`affiliate_payouts?${query.toString()}`, { method: 'GET' });
    const json = await response.json();
    const map = new Map();

    if (Array.isArray(json)) {
      json.forEach((row) => {
        if (row?.id) {
          map.set(row.id, row.status);
        }
      });
    }

    return map;
  } catch (_error) {
    return new Map();
  }
}

async function getAffiliateStats(affiliateId) {
  if (!affiliateId) {
    return emptyAffiliateStats();
  }

  const query = new URLSearchParams({
    select: '*',
    affiliate_id: `eq.${affiliateId}`,
  });
  const [response, payoutStatusById] = await Promise.all([
    supabaseRequest(`affiliate_commissions?${query.toString()}`, { method: 'GET' }),
    getAffiliatePayoutStatusMap(affiliateId),
  ]);
  const json = await response.json();
  const commissions = Array.isArray(json) ? json.map(normalizeCommission).filter(Boolean) : [];

  return summarizeAffiliateCommissions(commissions, payoutStatusById);
}

async function createAffiliateCommission({
  affiliate,
  buyerUserId,
  paymentId,
  planKey,
  billingKind,
  grossAmount,
  currencyId,
}) {
  if (!affiliate?.id || !paymentId) {
    return null;
  }

  const commissionRate = Number(affiliate.commission_rate) || COMMISSION_RATE;
  const commissionAmount = calculateCommissionAmount(grossAmount, commissionRate);

  if (!commissionAmount) {
    return null;
  }

  const payload = {
    affiliate_id: affiliate.id,
    buyer_user_id: isValidUserId(buyerUserId) ? buyerUserId : null,
    payment_id: String(paymentId),
    plan_key: planKey || 'monthly',
    billing_kind: billingKind || 'one_time',
    gross_amount: Number(grossAmount) || 0,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    currency_id: currencyId || 'BRL',
    status: 'pending',
  };
  const query = new URLSearchParams({
    on_conflict: 'payment_id',
  });

  const response = await supabaseRequest(`affiliate_commissions?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  return normalizeCommission(Array.isArray(json) ? json[0] : null);
}

module.exports = {
  createAffiliate,
  createAffiliateWithCode,
  createAffiliateCommission,
  getAffiliateByCode,
  getAffiliateByUserId,
  getAffiliateStats,
  normalizeAffiliateCode,
  resolveAffiliateForCheckout,
  summarizeAffiliateCommissions,
};
