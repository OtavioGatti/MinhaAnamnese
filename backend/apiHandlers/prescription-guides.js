const { ensureUserProfile } = require('../services/profiles');
const {
  getPrescriptionGuideBySlug,
  listPrescriptionGuides,
} = require('../services/prescriptionGuides');
const {
  buildTrialLimitError,
  ensureTrialFeatureAccess,
  recordTrialUsage,
} = require('../services/trialUsage');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/prescription-guides', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile, reason = 'pro_required') {
  const accessState = profile?.access_state || null;
  const isTrialLimit = reason === 'trial_limit_reached';

  return {
    success: false,
    error: isTrialLimit
      ? 'Você abriu os 5 guias de prescrição do teste profissional. Assine para continuar consultando protocolos.'
      : 'O Guia de Prescrição está disponível no plano profissional.',
    code: 'PRESCRIPTION_GUIDES_PRO_REQUIRED',
    data: {
      paywall: true,
      reason,
      profile,
      accessState,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
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

    if (!profile?.access_state?.hasActiveProAccess) {
      return res.status(402).json(buildPaywallResponse(profile));
    }

    const slug = getQueryParam(req, 'slug');

    if (slug) {
      const trialAccess = await ensureTrialFeatureAccess({
        userId: auth.user.id,
        profile,
        feature: 'prescriptionGuides',
        resourceKey: slug,
      });

      if (!trialAccess.allowed) {
        const trialError = buildTrialLimitError('prescriptionGuides', trialAccess.usage);
        const nextProfile = await ensureUserProfile(auth.user).catch(() => profile);

        return res
          .status(trialError.statusCode)
          .json(buildPaywallResponse(nextProfile, 'trial_limit_reached'));
      }

      const guide = await getPrescriptionGuideBySlug(slug);

      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia de prescrição não encontrado.',
        });
      }

      let nextProfile = profile;

      if (profile?.access_state?.isTrialAccess) {
        await recordTrialUsage({
          userId: auth.user.id,
          profile,
          feature: 'prescriptionGuides',
          resourceKey: slug,
          metadata: {
            title: guide.title,
          },
        }).catch(() => null);
        nextProfile = await ensureUserProfile(auth.user).catch(() => profile);
      }

      return res.status(200).json({
        success: true,
        data: {
          guide,
          profile: nextProfile,
          accessState: nextProfile?.access_state || null,
        },
      });
    }

    const guides = await listPrescriptionGuides({
      query: getQueryParam(req, 'q'),
      specialty: getQueryParam(req, 'specialty'),
      context: getQueryParam(req, 'context'),
      limit: getQueryParam(req, 'limit'),
    });

    return res.status(200).json({
      success: true,
      data: guides,
    });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : 'Não foi possível carregar o Guia de Prescrição agora.',
    });
  }
};
