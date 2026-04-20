const { getAnamneseActivity } = require('../../backend/services/anamneseMetrics');
const { resolveSupabaseUser } = require('../../backend/utils/supabaseAuth');

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

    const data = await getAnamneseActivity(auth.user.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (_error) {
    return res.status(200).json({
      success: true,
      data: [],
    });
  }
};
