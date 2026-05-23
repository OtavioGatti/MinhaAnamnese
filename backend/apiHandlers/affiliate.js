const {
  createAffiliate,
  createAffiliateWithCode,
  getAffiliateByUserId,
  getAffiliateStats,
  normalizeAffiliateCode,
} = require('../services/affiliates');
const { ensureUserProfile } = require('../services/profiles');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function buildAffiliateResponse(affiliate, stats = null) {
  return {
    affiliate,
    stats: stats || {
      totalCommission: 0,
      pendingCommission: 0,
      paidCommission: 0,
      conversions: 0,
    },
  };
}

module.exports = async function handler(req, res) {
  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({
      success: false,
      error: auth.error,
    });
  }

  const profile = await ensureUserProfile(auth.user).catch(() => null);

  if (!profile?.access_state?.isAffiliate) {
    return res.status(403).json({
      success: false,
      error: 'Area de afiliados restrita.',
    });
  }

  if (req.method === 'GET') {
    const affiliate = await getAffiliateByUserId(auth.user.id).catch(() => null);
    const stats = affiliate?.id ? await getAffiliateStats(affiliate.id).catch(() => null) : null;

    return res.status(200).json({
      success: true,
      data: buildAffiliateResponse(affiliate, stats),
    });
  }

  if (req.method === 'POST') {
    try {
      const requestedCode = normalizeAffiliateCode(req.body?.code);
      const affiliate = requestedCode
        ? await createAffiliateWithCode(auth.user, requestedCode)
        : await createAffiliate(auth.user);
      const stats = affiliate?.id ? await getAffiliateStats(affiliate.id).catch(() => null) : null;

      return res.status(200).json({
        success: true,
        data: buildAffiliateResponse(affiliate, stats),
      });
    } catch (error) {
      if (error?.code === 'INVALID_AFFILIATE_CODE') {
        return res.status(400).json({
          success: false,
          error: 'Escolha um codigo com pelo menos 3 caracteres.',
        });
      }

      if (error?.code === 'AFFILIATE_CODE_TAKEN') {
        return res.status(409).json({
          success: false,
          error: 'Esse codigo ja esta em uso. Tente outro.',
        });
      }

      return res.status(503).json({
        success: false,
        error: 'Programa de afiliados indisponivel no momento.',
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Metodo nao permitido.',
  });
};
