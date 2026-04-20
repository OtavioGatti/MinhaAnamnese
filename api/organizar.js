const { processAnamnesis, validateProcessAnamnesisInput } = require('../backend/services/processAnamnesis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const validationError = validateProcessAnamnesisInput(req.body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      error: validationError,
    });
  }

  try {
    const data = await processAnamnesis(req.body);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('organizar: failed to process anamnese', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Erro interno ao processar a anamnese.',
    });
  }
};
