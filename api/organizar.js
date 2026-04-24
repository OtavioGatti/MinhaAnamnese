const { processAnamnesis, validateProcessAnamnesisInput } = require('../backend/services/processAnamnesis');
const { consumeRateLimit, sendRateLimitResponse } = require('../backend/utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../backend/utils/requestLimits');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../backend/utils/supabaseAuth');

const ORGANIZAR_RATE_LIMIT = {
  limit: 20,
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
      error: 'Método não permitido',
    });
  }

  const { template, texto } = req.body || {};
  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return sendTextLimitError(res, textLimitError);
  }

  const validationError = validateProcessAnamnesisInput({ template, texto });

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
      scope: 'organizar',
      userId: resolvedUserId,
      ...ORGANIZAR_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const data = await processAnamnesis({
      template,
      texto,
      userId: resolvedUserId,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('organizar: failed to process anamnese', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Erro interno ao processar a anamnese.',
    });
  }
};
