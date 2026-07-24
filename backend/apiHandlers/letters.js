const { generateLetter, validateLetterInput } = require('../services/letters');
const { getUserLetterModelFormat } = require('../services/userLetterModels');
const { normalizeLetterTypeKey } = require('../config/letterTypes');
const { ensureUserProfile } = require('../services/profiles');
const { recordTrialUsage } = require('../services/trialUsage');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const LETTERS_RATE_LIMIT = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
};

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;
  const isExpired = accessState?.billingStatus === 'expired';

  return {
    success: false,
    error: isExpired
      ? 'Seu acesso profissional expirou. Reative o plano para gerar cartas e documentos.'
      : 'A geração de cartas e documentos com IA faz parte do plano profissional.',
    code: 'LETTER_PRO_REQUIRED',
    data: {
      paywall: true,
      reason: isExpired ? 'expired' : 'pro_required',
      profile,
      accessState,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const { texto, structuredText, letterType, fields, modelId } = req.body || {};
  const textLimitError = getTextLimitError(texto, 'texto da anamnese')
    || getTextLimitError(structuredText, 'resultado estruturado');

  if (textLimitError) {
    return sendTextLimitError(res, textLimitError);
  }

  const validationError = validateLetterInput({ letterType, texto, structuredText, fields });

  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }

    const rateLimit = await consumeRateLimit({
      req,
      scope: 'letters',
      userId: auth.user.id,
      ...LETTERS_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const profile = await ensureUserProfile(auth.user);
    const accessState = profile?.access_state || null;

    if (!accessState?.hasActiveProAccess) {
      return res.status(402).json(buildPaywallResponse(profile));
    }

    const formatTemplate = modelId
      ? await getUserLetterModelFormat(auth.user.id, modelId).catch(() => '')
      : '';

    const data = await generateLetter({
      letterType,
      fields: fields || {},
      texto,
      structuredText,
      formatTemplate,
    });

    let nextProfile = profile;

    if (accessState?.isTrialAccess) {
      await recordTrialUsage({
        userId: auth.user.id,
        profile,
        feature: 'referralLetters',
        metadata: { letterType: normalizeLetterTypeKey(letterType) },
      }).catch(() => null);
      nextProfile = await ensureUserProfile(auth.user).catch(() => profile);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        profile: nextProfile,
        accessState: nextProfile?.access_state || null,
      },
    });
  } catch (error) {
    console.error('letters: failed to generate letter', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Erro ao gerar o documento.',
    });
  }
};
