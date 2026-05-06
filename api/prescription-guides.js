const { ensureUserProfile } = require('../backend/services/profiles');
const {
  getPrescriptionGuideBySlug,
  listPrescriptionGuides,
} = require('../backend/services/prescriptionGuides');
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/prescription-guides', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  return {
    success: false,
    error: 'O Guia de Prescrição está disponível no plano profissional.',
    code: 'PRESCRIPTION_GUIDES_PRO_REQUIRED',
    data: {
      paywall: true,
      profile,
      accessState: profile?.access_state || null,
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
      const guide = await getPrescriptionGuideBySlug(slug);

      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia de prescrição não encontrado.',
        });
      }

      return res.status(200).json({
        success: true,
        data: guide,
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
