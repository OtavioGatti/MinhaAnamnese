const { generateInsights, validateGenerateInsightsInput } = require('../services/generateInsights');
const { ensureUserProfile } = require('../services/profiles');
const {
  recordTrialUsage,
} = require('../services/trialUsage');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { getTextLimitError, sendTextLimitError } = require('../utils/requestLimits');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const INSIGHTS_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

function buildPaywallResponse(profile, reason) {
  const accessState = profile?.access_state || null;
  const isExpired = accessState?.billingStatus === 'expired';

  return {
    success: false,
    error: isExpired
        ? 'Seu acesso profissional expirou. Reative o plano para continuar vendo a análise completa.'
        : 'Seu resultado estruturado já está pronto. Assine o plano profissional para ver lacunas, impacto e próximo passo clínico.',
    code: 'INSIGHTS_PAYWALL',
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

  const { texto, templateId, originalText } = req.body || {};
  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return sendTextLimitError(res, textLimitError);
  }

  const originalTextLimitError = getTextLimitError(originalText, 'texto original da anamnese');

  if (originalTextLimitError) {
    return sendTextLimitError(res, originalTextLimitError);
  }

  const validationError = validateGenerateInsightsInput({ texto, templateId });

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

    const rateLimit = await consumeRateLimit({
      req,
      scope: 'insights',
      userId: auth.user.id,
      ...INSIGHTS_RATE_LIMIT,
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

    const data = await generateInsights({
      texto,
      templateId,
      userId: auth.user.id,
      originalText,
    });

    let nextProfile = profile;

    if (accessState?.isTrialAccess) {
      await recordTrialUsage({
        userId: auth.user.id,
        profile,
        feature: 'insights',
        metadata: {
          templateId,
        },
      }).catch(() => null);
      nextProfile = await ensureUserProfile(auth.user).catch(() => profile);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        profile: nextProfile || profile || null,
        accessState: nextProfile?.access_state || profile?.access_state || null,
      },
    });
  } catch (error) {
    console.error('insights: failed to generate insights', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Erro ao gerar insights',
    });
  }
};
