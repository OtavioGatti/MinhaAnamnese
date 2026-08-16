const { ensureUserProfile } = require('../services/profiles');
const {
  getDiagnosticExamBySlug,
  listDiagnosticExams,
} = require('../services/diagnosticExams');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/diagnostic-exams', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;

  return {
    success: false,
    error: 'Os exames complementares estão disponíveis no plano profissional.',
    code: 'DIAGNOSTIC_EXAMS_PRO_REQUIRED',
    data: {
      paywall: true,
      reason: accessState?.billingStatus === 'expired' ? 'expired' : 'pro_required',
      profile,
      accessState,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }

    const profile = await ensureUserProfile(auth.user);

    if (!profile?.access_state?.hasActiveProAccess) {
      return res.status(402).json(buildPaywallResponse(profile));
    }

    const slug = getQueryParam(req, 'slug');

    if (slug) {
      const exam = await getDiagnosticExamBySlug(slug);

      if (!exam) {
        return res.status(404).json({ success: false, error: 'Exame não encontrado.' });
      }

      return res.status(200).json({ success: true, data: { exam } });
    }

    const exams = await listDiagnosticExams({
      query: getQueryParam(req, 'q'),
      category: getQueryParam(req, 'category'),
      limit: getQueryParam(req, 'limit'),
    });

    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    console.error('diagnostic-exams: failed to load catalog', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 503).json({
      success: false,
      error: 'Não foi possível carregar os exames agora.',
    });
  }
};
