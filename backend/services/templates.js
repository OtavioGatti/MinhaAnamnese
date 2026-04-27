const templates = require('../templates/templates');
const {
  getUserTemplateConfig,
  isCustomTemplateId,
  listUserTemplates,
} = require('./userTemplates');

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
    secoes: template.secoes,
    source: 'official',
  }));
}

async function resolveTemplateById(templateId, userId = null) {
  const officialTemplate = getTemplateById(templateId);

  if (officialTemplate) {
    return officialTemplate;
  }

  if (!isCustomTemplateId(templateId)) {
    return null;
  }

  return getUserTemplateConfig(templateId, userId);
}

async function listTemplatesForUser(userId = null) {
  const officialTemplates = listTemplates();
  const customTemplates = await listUserTemplates(userId).catch(() => []);

  return [
    ...officialTemplates,
    ...customTemplates,
  ];
}

module.exports = {
  getTemplateById,
  listTemplates,
  listTemplatesForUser,
  resolveTemplateById,
};
