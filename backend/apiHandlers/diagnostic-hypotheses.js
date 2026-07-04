const {
  generateDiagnosticHypotheses,
  validateDiagnosticHypothesesInput,
} = require('../services/generateDiagnosticHypotheses');
const { ensureUserProfile } = require('../services/profiles');
const { recordTrialUsage } = require('../services/trialUsage');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const DIAGNOSTIC_HYPOTHESES_RATE_LIMIT = {
  limit: 8,
  windowMs: 10 * 60 * 1000,
};

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;
  const isExpired = accessState?.billingStatus === 'expired';

  return {
    success: false,
    error: isExpired
      ? 'Seu acesso profissional expirou. Reative o plano para sugerir hipóteses diagnósticas.'
      : 'A sugestão de hipóteses diagnósticas faz parte do plano profissional.',
    code: 'DIAGNOSTIC_HYPOTHESES_PRO_REQUIRED',
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
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const { template, structuredText } = req.body || {};
  const textLimitError = getTextLimitError(structuredText, 'resultado estruturado');

  if (textLimitError) {
    return sendTextLimitError(res, textLimitError);
  }

  const validationError = validateDiagnosticHypothesesInput({ template, structuredText });

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
      scope: 'diagnostic-hypotheses',
      userId: auth.user.id,
      ...DIAGNOSTIC_HYPOTHESES_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const profile = await ensureUserProfile(auth.user);

    if (!profile?.access_state?.hasActiveProAccess) {
      return res.status(402).json(buildPaywallResponse(profile));
    }

    const hypotheses = await generateDiagnosticHypotheses({
      template,
      structuredText,
      userId: auth.user.id,
    });
    let nextProfile = profile;

    if (profile.access_state.isTrialAccess) {
      await recordTrialUsage({
        userId: auth.user.id,
        profile,
        feature: 'diagnosticHypotheses',
        metadata: {
          template,
          hypothesisCount: hypotheses.hypotheses.length,
          status: hypotheses.status,
        },
      }).catch(() => null);
      nextProfile = await ensureUserProfile(auth.user).catch(() => profile);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...hypotheses,
        profile: nextProfile,
        accessState: nextProfile?.access_state || null,
      },
    });
  } catch (error) {
    console.error('diagnostic-hypotheses: generation failed', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    const statusCode = error.statusCode || 500;
    const safeMessage = statusCode < 500
      ? error.message
      : statusCode === 503
        ? error.message
        : 'Não foi possível sugerir hipóteses diagnósticas agora.';

    return res.status(statusCode).json({ success: false, error: safeMessage });
  }
};
