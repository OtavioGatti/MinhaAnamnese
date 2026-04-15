/**
 * Validações para as rotas da API
 */

const templates = require('../templates/templates');

function validateOrganizar(req, res, next) {
  const { template, texto } = req.body;

  if (!template || !templates[template]) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Template inválido. Escolha um dos templates disponíveis.',
    });
  }

  if (!texto || texto.trim().length === 0) {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'O texto não pode estar vazio.',
    });
  }

  next();
}

module.exports = { validateOrganizar };
