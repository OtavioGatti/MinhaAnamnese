const { ensureUserProfile } = require('../services/profiles');
const {
  getClinicalDrugBySlug,
  listClinicalDrugs,
} = require('../services/clinicalDrugs');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/clinical-drugs', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;

  return {
    success: false,
    error: 'O Bulario Clinico esta disponivel no plano profissional.',
    code: 'CLINICAL_DRUGS_PRO_REQUIRED',
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
      error: 'Metodo nao permitido',
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
      const drug = await getClinicalDrugBySlug(slug);

      if (!drug) {
        return res.status(404).json({
          success: false,
          error: 'Medicamento nao encontrado no Bulario Clinico.',
        });
      }

      return res.status(200).json({
        success: true,
        data: drug,
      });
    }

    const drugs = await listClinicalDrugs({
      query: getQueryParam(req, 'q'),
      limit: getQueryParam(req, 'limit'),
    });

    return res.status(200).json({
      success: true,
      data: drugs,
    });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      error: error.statusCode && error.statusCode < 500
        ? error.message
        : 'Nao foi possivel carregar o Bulario Clinico agora.',
    });
  }
};
