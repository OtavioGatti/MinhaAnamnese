const { ensureUserProfile } = require('../backend/services/profiles');
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

function getProfileUpdatesFromRequest(req) {
  const body = req.body || {};

  return {
    last_template_used:
      Object.prototype.hasOwnProperty.call(body, 'last_template_used')
        ? body.last_template_used
        : undefined,
    default_contextual_tab:
      Object.prototype.hasOwnProperty.call(body, 'default_contextual_tab')
        ? body.default_contextual_tab
        : undefined,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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

    const profile = await ensureUserProfile(
      auth.user,
      req.method === 'POST' ? getProfileUpdatesFromRequest(req) : {},
    );

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (_error) {
    return res.status(503).json({
      success: false,
      error: 'Nao foi possivel sincronizar o perfil agora.',
    });
  }
};
