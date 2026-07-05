const { normalizeAffiliateCode } = require('../../services/affiliates');
const { MAX_AFFILIATE_DISCOUNT_RATE } = require('../../config/billingPlans');
const { hasAdminSecretConfigured, isAuthorizedAdminRequest } = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const UPDATE_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};
const DISCOUNT_LABEL_MAX_LENGTH = 80;

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function parseRate(value, { min, max }) {
  if (value === undefined) {
    return { present: false, value: null, valid: true };
  }

  const numericValue = Number(value);
  const valid = Number.isFinite(numericValue) && numericValue >= min && numericValue <= max;

  return { present: true, value: numericValue, valid };
}

// Atualização administrativa de um afiliado (comissão, desconto e status),
// protegida por ADMIN_SYNC_SECRET — alternativa ao UPDATE manual no Supabase.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'admin_affiliates_update',
    ...UPDATE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Administração de afiliados não configurada.',
    });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado.',
    });
  }

  const body = req.body || {};
  const code = normalizeAffiliateCode(body.code);

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Informe o código do afiliado.',
    });
  }

  const commissionRate = parseRate(body.commissionRate, { min: 0, max: 1 });
  const discountRate = parseRate(body.discountRate, { min: 0, max: MAX_AFFILIATE_DISCOUNT_RATE });

  if (!commissionRate.valid) {
    return res.status(400).json({
      success: false,
      error: 'commissionRate deve estar entre 0 e 1.',
    });
  }

  if (!discountRate.valid) {
    return res.status(400).json({
      success: false,
      error: `discountRate deve estar entre 0 e ${MAX_AFFILIATE_DISCOUNT_RATE}.`,
    });
  }

  const updates = {};

  if (commissionRate.present) {
    updates.commission_rate = commissionRate.value;
  }

  if (discountRate.present) {
    updates.discount_rate = discountRate.value;
  }

  if (body.discountLabel !== undefined) {
    const label = String(body.discountLabel || '').trim().slice(0, DISCOUNT_LABEL_MAX_LENGTH);
    updates.discount_label = label || null;
  }

  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase();

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status deve ser 'active' ou 'paused'.",
      });
    }

    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Informe ao menos um campo para atualizar (commissionRate, discountRate, discountLabel, status).',
    });
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return res.status(503).json({
      success: false,
      error: 'Administração de afiliados indisponível no momento.',
    });
  }

  try {
    const query = new URLSearchParams({ code: `eq.${code}` });
    const response = await fetch(`${url}/rest/v1/affiliates?${query.toString()}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`affiliate update failed with status ${response.status}`);
    }

    const json = await response.json();

    if (!Array.isArray(json) || json.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Afiliado não encontrado para o código informado.',
      });
    }

    const record = json[0];

    return res.status(200).json({
      success: true,
      data: {
        code: record.code,
        status: record.status,
        commission_rate: Number(record.commission_rate) || 0,
        discount_rate: Number(record.discount_rate) || 0,
        discount_label: record.discount_label || null,
      },
    });
  } catch (error) {
    console.error('admin affiliates update failed', {
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Administração de afiliados indisponível no momento.',
    });
  }
};
