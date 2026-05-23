const { createAffiliate, getAffiliateByUserId, getAffiliateStats } = require('../services/affiliates');
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
      const affiliate = await createAffiliate(auth.user);
      const stats = affiliate?.id ? await getAffiliateStats(affiliate.id).catch(() => null) : null;

      return res.status(200).json({
        success: true,
        data: buildAffiliateResponse(affiliate, stats),
      });
    } catch (_error) {
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
