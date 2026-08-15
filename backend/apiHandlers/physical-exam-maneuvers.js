const { ensureUserProfile } = require('../services/profiles');
const {
  getPhysicalExamManeuverBySlug,
  listPhysicalExamManeuvers,
} = require('../services/physicalExamManeuvers');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/physical-exam-maneuvers', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;

  return {
    success: false,
    error: 'As manobras de exame físico estão disponíveis no plano profissional.',
    code: 'PHYSICAL_EXAM_MANEUVERS_PRO_REQUIRED',
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
      const maneuver = await getPhysicalExamManeuverBySlug(slug);

      if (!maneuver) {
        return res.status(404).json({ success: false, error: 'Manobra não encontrada.' });
      }

      return res.status(200).json({ success: true, data: { maneuver } });
    }

    const maneuvers = await listPhysicalExamManeuvers({
      query: getQueryParam(req, 'q'),
      category: getQueryParam(req, 'category'),
      limit: getQueryParam(req, 'limit'),
    });

    return res.status(200).json({ success: true, data: maneuvers });
  } catch (error) {
    console.error('physical-exam-maneuvers: failed to load catalog', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 503).json({
      success: false,
      error: 'Não foi possível carregar as manobras agora.',
    });
  }
};
