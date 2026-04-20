const templates = require('../templates/templates');

function getTemplateById(templateId) {
  if (!templateId || typeof templateId !== 'string') {
    return null;
  }

  return templates[templateId] || null;
}

function listTemplates() {
  return Object.entries(templates).map(([id, template]) => ({
    id,
    nome: template.nome,
  }));
}

module.exports = {
  getTemplateById,
  listTemplates,
};
