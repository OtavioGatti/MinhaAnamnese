const { generateReferralLetter, validateReferralLetterInput } = require('../services/referralLetters');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');

const REFERRAL_LETTER_RATE_LIMIT = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
};

async function resolveOptionalUserId(req) {
  if (!getAccessTokenFromRequest(req)) {
    return null;
  }

  const auth = await resolveSupabaseUser(req);
  return auth.user?.id || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

  const { texto, structuredText, specialty, reason } = req.body || {};
  const textLimitError = getTextLimitError(texto, 'texto da anamnese')
    || getTextLimitError(structuredText, 'resultado estruturado');

  if (textLimitError) {
    return sendTextLimitError(res, textLimitError);
  }

  const validationError = validateReferralLetterInput({
    texto,
    structuredText,
    specialty,
    reason,
  });

  if (validationError) {
    return res.status(400).json({
      success: false,
      error: validationError,
    });
  }

  try {
    const resolvedUserId = await resolveOptionalUserId(req);
    const rateLimit = consumeRateLimit({
      req,
      scope: 'referral-letter',
      userId: resolvedUserId,
      ...REFERRAL_LETTER_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const data = await generateReferralLetter({
      texto,
      structuredText,
      specialty,
      reason,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('referral-letter: failed to generate letter', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Erro ao gerar carta de encaminhamento.',
    });
  }
};
