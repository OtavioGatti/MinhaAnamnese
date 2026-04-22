const { generateInsights, validateGenerateInsightsInput } = require('../backend/services/generateInsights');
const { hasProPlan, resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

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

    if (!hasProPlan(auth.user)) {
      return res.status(403).json({
        success: false,
        error: 'Plano profissional obrigatório para acessar insights completos.',
      });
    }

    const data = await generateInsights({
      texto,
      templateId,
      userId: auth.user.id,
    });

    return res.status(200).json({
      success: true,
      data,
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
