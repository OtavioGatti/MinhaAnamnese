const { generateReferralLetter, validateReferralLetterInput } = require('../services/referralLetters');
const { ensureUserProfile } = require('../services/profiles');
const {
  buildTrialLimitError,
  ensureTrialFeatureAccess,
  recordTrialUsage,
} = require('../services/trialUsage');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const REFERRAL_LETTER_RATE_LIMIT = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
};

function buildPaywallResponse(profile, reason) {
  const accessState = profile?.access_state || null;
  const isExpired = accessState?.billingStatus === 'expired';
  const isTrialLimit = reason === 'trial_limit_reached';

  return {
    success: false,
    error: isTrialLimit
      ? 'Você usou os 5 encaminhamentos do teste profissional. Assine para continuar gerando cartas.'
      : isExpired
        ? 'Seu acesso profissional expirou. Reative o plano para gerar cartas de encaminhamento.'
        : 'Cartas de encaminhamento com IA fazem parte do plano profissional.',
    code: 'REFERRAL_LETTER_PRO_REQUIRED',
    data: {
      paywall: true,
      reason,
      profile,
      accessState,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
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
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({
        success: false,
        error: auth.error,
      });
    }

    const rateLimit = consumeRateLimit({
      req,
      scope: 'referral-letter',
      userId: auth.user.id,
      ...REFERRAL_LETTER_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const profile = await ensureUserProfile(auth.user);
    const accessState = profile?.access_state || null;

    if (!accessState?.hasActiveProAccess) {
      return res
        .status(402)
        .json(buildPaywallResponse(profile, accessState?.billingStatus === 'expired' ? 'expired' : 'pro_required'));
    }

    const trialAccess = await ensureTrialFeatureAccess({
      userId: auth.user.id,
      profile,
      feature: 'referralLetters',
    });

    if (!trialAccess.allowed) {
      const trialError = buildTrialLimitError('referralLetters', trialAccess.usage);
      const nextProfile = await ensureUserProfile(auth.user).catch(() => profile);

      return res
        .status(trialError.statusCode)
        .json(buildPaywallResponse(nextProfile, 'trial_limit_reached'));
    }

    const data = await generateReferralLetter({
      texto,
      structuredText,
      specialty,
      reason,
    });
    let nextProfile = profile;

    if (accessState?.isTrialAccess) {
      await recordTrialUsage({
        userId: auth.user.id,
        profile,
        feature: 'referralLetters',
        metadata: {
          specialty,
        },
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
