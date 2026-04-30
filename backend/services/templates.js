const templates = require('../templates/templates');
const {
  getSyncedOfficialTemplateConfig,
  listSyncedOfficialTemplates,
  normalizeSlug,
} = require('./officialTemplates');
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

function isPotentialOfficialTemplateId(templateId) {
  return (
    typeof templateId === 'string' &&
    templateId.length <= 80 &&
    normalizeSlug(templateId) === templateId
  );
}

function sortTemplatesForDisplay(items) {
  const fallbackOrder = new Map(listTemplates().map((template, index) => [template.id, index + 1000]));

  return [...items].sort((a, b) => {
    const firstOrder = Number.isFinite(Number(a.displayOrder))
      ? Number(a.displayOrder)
      : fallbackOrder.get(a.id) || 1000;
    const secondOrder = Number.isFinite(Number(b.displayOrder))
      ? Number(b.displayOrder)
      : fallbackOrder.get(b.id) || 1000;

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

async function resolveTemplateById(templateId, userId = null) {
  const officialTemplate = getTemplateById(templateId);
  const syncedOfficialTemplate = isPotentialOfficialTemplateId(templateId)
    ? await getSyncedOfficialTemplateConfig(templateId, officialTemplate).catch(() => null)
    : null;

  if (syncedOfficialTemplate) {
    return syncedOfficialTemplate;
  }

  if (officialTemplate) {
    return officialTemplate;
  }

  if (!isCustomTemplateId(templateId)) {
    return null;
  }

  return getUserTemplateConfig(templateId, userId);
}

async function listTemplatesForUser(userId = null) {
  const officialTemplatesById = new Map(listTemplates().map((template) => [template.id, template]));
  const syncedOfficialTemplates = await listSyncedOfficialTemplates().catch(() => []);
  const customTemplates = await listUserTemplates(userId).catch(() => []);

  syncedOfficialTemplates.forEach((template) => {
    const fallback = officialTemplatesById.get(template.id) || {};
    officialTemplatesById.set(template.id, {
      ...fallback,
      ...template,
      source: 'official',
    });
  });

  return [
    ...sortTemplatesForDisplay([...officialTemplatesById.values()]),
    ...customTemplates,
  ];
}

module.exports = {
  getTemplateById,
  isPotentialOfficialTemplateId,
  listTemplates,
  listTemplatesForUser,
  resolveTemplateById,
};
