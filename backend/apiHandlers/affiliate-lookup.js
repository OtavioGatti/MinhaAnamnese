const { getAffiliateByCode, normalizeAffiliateCode } = require('../services/affiliates');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const LOOKUP_RATE_LIMIT = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
};

// Consulta pública de código de indicação: devolve apenas o necessário para a
// UI exibir o desconto (nunca dados do dono do código).
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'affiliate_lookup',
    ...LOOKUP_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  const code = normalizeAffiliateCode(req.query?.code);

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Informe um código de indicação.',
    });
  }

  const affiliate = await getAffiliateByCode(code).catch(() => null);

  return res.status(200).json({
    success: true,
    data: {
      code,
      valid: Boolean(affiliate?.id),
      discountRate: affiliate?.discount_rate || 0,
      discountLabel: affiliate?.discount_label || null,
    },
  });
};
