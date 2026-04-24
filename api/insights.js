const { generateInsights, validateGenerateInsightsInput } = require('../backend/services/generateInsights');
const { ensureUserProfile, incrementFreeFullInsightsUsedCount } = require('../backend/services/profiles');
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

function buildPaywallResponse(profile, reason) {
  const accessState = profile?.access_state || null;
  const isExpired = accessState?.billingStatus === 'expired';

  return {
    success: false,
    error: isExpired
      ? 'Seu acesso profissional expirou. Reative o plano para continuar vendo a análise completa.'
      : 'Seu resultado estruturado já está pronto. Desbloqueie a análise completa para ver lacunas, impacto e próximo passo clínico.',
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

  const { texto, templateId } = req.body || {};
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

    const profile = await ensureUserProfile(auth.user);
    const accessState = profile?.access_state || null;
    const hasActiveProAccess = Boolean(accessState?.hasActiveProAccess);
    const hasFreeFullInsightAvailable = Boolean(accessState?.hasFreeFullInsightAvailable);

    if (!hasActiveProAccess && !hasFreeFullInsightAvailable) {
      return res
        .status(402)
        .json(buildPaywallResponse(profile, accessState?.billingStatus === 'expired' ? 'expired' : 'trial_consumed'));
    }

    const data = await generateInsights({
      texto,
      templateId,
      userId: auth.user.id,
    });

    let nextProfile = profile;

    if (!hasActiveProAccess && hasFreeFullInsightAvailable) {
      await incrementFreeFullInsightsUsedCount(
        auth.user.id,
        accessState?.freeFullInsightsUsedCount || 0,
      ).catch(() => null);
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
