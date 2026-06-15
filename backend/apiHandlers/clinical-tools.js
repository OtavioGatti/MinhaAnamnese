const { ensureUserProfile } = require('../services/profiles');
const {
  getClinicalToolBySlug,
  listClinicalTools,
} = require('../services/clinicalTools');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/clinical-tools', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;

  return {
    success: false,
    error: 'As Ferramentas Clínicas estão disponíveis no plano profissional.',
    code: 'CLINICAL_TOOLS_PRO_REQUIRED',
    data: {
      paywall: true,
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
      const tool = await getClinicalToolBySlug(slug);

      if (!tool) {
        return res.status(404).json({
          success: false,
          error: 'Ferramenta clínica não encontrada.',
        });
      }

      return res.status(200).json({
        success: true,
        data: tool,
      });
    }

    const tools = await listClinicalTools({
      query: getQueryParam(req, 'q'),
      category: getQueryParam(req, 'category'),
      limit: getQueryParam(req, 'limit'),
    });

    return res.status(200).json({
      success: true,
      data: tools,
    });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : 'Não foi possível carregar as Ferramentas Clínicas agora.',
    });
  }
};
