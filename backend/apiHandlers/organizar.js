const { processAnamnesis, validateProcessAnamnesisInput } = require('../services/processAnamnesis');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');

const ORGANIZAR_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

const LOGIN_REQUIRED_MESSAGE = 'Entre ou crie sua conta grátis para organizar a anamnese.';

// Organizar só com conta: liga com ORGANIZE_LOGIN_REQUIRED=true no Render (e
// VITE_ORGANIZE_LOGIN_REQUIRED=on na Vercel, para o site pedir o cadastro antes
// de chamar aqui). Desligado, segue aberto como sempre foi. A trava real é esta:
// sem ela, qualquer um chamaria a OpenAI direto pela API.
function isOrganizeLoginRequired() {
  return String(process.env.ORGANIZE_LOGIN_REQUIRED || '').trim().toLowerCase() === 'true';
}

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

    if (!resolvedUserId && isOrganizeLoginRequired()) {
      return res.status(401).json({
        success: false,
        error: LOGIN_REQUIRED_MESSAGE,
        code: 'LOGIN_REQUIRED',
      });
    }

    const rateLimit = await consumeRateLimit({
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

// Anexado depois da atribuição acima, para o teste da chave.
module.exports.isOrganizeLoginRequired = isOrganizeLoginRequired;
