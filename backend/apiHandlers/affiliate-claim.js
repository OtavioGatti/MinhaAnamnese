const {
  claimAffiliateReferral,
  getAffiliateByCode,
  getStoredReferralAffiliate,
  normalizeAffiliateCode,
  summarizeReferral,
} = require('../services/affiliates');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const CLAIM_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

// Grava na conta a indicação que o navegador trouxe — link aberto em outro
// dispositivo, ou antes de a pessoa ter conta. Sem isto, quem clica no link no
// celular e assina no computador chega ao checkout sem código e o afiliado
// perde a comissão.
//
// Write-once: se a conta já tem indicação, nada muda, e a resposta devolve a
// que vale (que pode ser diferente do código enviado).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const code = normalizeAffiliateCode(req.body?.code);

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Informe um código de indicação.',
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
    scope: 'affiliate_claim',
    ...CLAIM_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  try {
    const affiliate = await getAffiliateByCode(code).catch(() => null);
    const result = affiliate
      ? await claimAffiliateReferral({ userId: auth.user.id, affiliate, source: req.body?.source })
      : { claimed: false };
    const referral = await getStoredReferralAffiliate(auth.user.id);

    return res.status(200).json({
      success: true,
      data: {
        valid: Boolean(affiliate),
        claimed: result.claimed,
        referral: summarizeReferral(referral),
      },
    });
  } catch (_error) {
    return res.status(503).json({
      success: false,
      error: 'Não foi possível registrar a indicação agora.',
    });
  }
};
