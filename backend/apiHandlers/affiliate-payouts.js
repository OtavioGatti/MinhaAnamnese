const {
  getAffiliateByUserId,
  getAffiliateStats,
} = require('../services/affiliates');
const {
  getPayoutMinAmount,
  listAffiliatePayouts,
  notifyPayoutRequested,
  requestAffiliatePayout,
} = require('../services/affiliatePayouts');
const { ensureUserProfile } = require('../services/profiles');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const PAYOUT_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};
const PIX_KEY_MAX_LENGTH = 140;

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

function normalizePixKey(value) {
  return String(value || '').trim().slice(0, PIX_KEY_MAX_LENGTH);
}

// URL pública do backend derivada da própria requisição (host do Render),
// para os links de baixa funcionarem sem depender de PUBLIC_API_URL.
function getRequestBaseUrl(req) {
  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const protocol = forwardedProto || 'https';

  return host ? `${protocol}://${host}` : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({
      success: false,
      error: auth.error,
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'affiliate_payout',
    userId: auth.user.id,
    ...PAYOUT_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  const profile = await ensureUserProfile(auth.user).catch(() => null);

  if (!profile?.access_state?.isAffiliate) {
    return res.status(403).json({
      success: false,
      error: 'Área de afiliados restrita.',
    });
  }

  const affiliate = await getAffiliateByUserId(auth.user.id).catch(() => null);

  if (!affiliate?.id) {
    return res.status(404).json({
      success: false,
      error: 'Crie seu link de afiliado antes de solicitar um saque.',
    });
  }

  const pixKey = normalizePixKey(req.body?.pixKey);

  if (!pixKey) {
    return res.status(400).json({
      success: false,
      error: 'Informe sua chave PIX para receber o saque.',
    });
  }

  try {
    const payout = await requestAffiliatePayout({
      affiliateId: affiliate.id,
      pixKey,
    });

    await notifyPayoutRequested({ payout, affiliate, baseUrl: getRequestBaseUrl(req) }).catch(() => false);

    const [stats, payouts] = await Promise.all([
      getAffiliateStats(affiliate.id).catch(() => null),
      listAffiliatePayouts(affiliate.id).catch(() => []),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payout,
        stats,
        payouts,
        payoutMinAmount: getPayoutMinAmount(),
      },
    });
  } catch (error) {
    if (error?.code === 'payout_already_open') {
      return res.status(409).json({
        success: false,
        error: 'Você já tem um saque em processamento. Aguarde a transferência para solicitar outro.',
      });
    }

    if (error?.code === 'below_minimum') {
      const minimum = Number(error?.details?.minimum) || getPayoutMinAmount();
      const available = Number(error?.details?.available) || 0;

      return res.status(400).json({
        success: false,
        error: `Saldo disponível de ${formatCurrencyBRL(available)} abaixo do mínimo de ${formatCurrencyBRL(minimum)} para saque.`,
      });
    }

    console.error('affiliate-payouts: failed to request payout', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Saques indisponíveis no momento. Tente novamente mais tarde.',
    });
  }
};
