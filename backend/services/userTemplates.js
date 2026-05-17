const { isValidUserId } = require('../utils/idValidation');
const officialTemplates = require('../templates/templates');
const {
  getLegacyClinicalCategoryKey,
  getLegacyClinicalCategoryKeyByCategoryKey,
  resolveCategory,
} = require('../utils/categoryKeys');

const CUSTOM_TEMPLATE_PREFIX = 'custom:';
const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 240;
const MAX_SECTION_LENGTH = 80;
const MAX_SECTIONS = 24;
const CLINICAL_CATEGORY_SOURCE_TEMPLATE = {
  general: 'clinica_medica',
  psychiatry: 'psiquiatria',
  pediatrics: 'pediatria',
  obstetrics: 'obstetricia',
  emergency: 'upa_emergencia',
  gynecology: 'ginecologia',
  postpartum: 'puerperio',
  triage: 'triagem',
};

function getUserTemplatesAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isUserTemplatesStorageAvailable() {
  const { url, serviceRoleKey } = getUserTemplatesAdminConfig();
  return Boolean(url && serviceRoleKey);
}

function formatCustomTemplateId(templateId) {
  return `${CUSTOM_TEMPLATE_PREFIX}${templateId}`;
}

function parseCustomTemplateId(templateId) {
  if (typeof templateId !== 'string' || !templateId.startsWith(CUSTOM_TEMPLATE_PREFIX)) {
    return null;
  }

  const rawId = templateId.slice(CUSTOM_TEMPLATE_PREFIX.length);
  return isValidUserId(rawId) ? rawId : null;
}

function isCustomTemplateId(templateId) {
  return Boolean(parseCustomTemplateId(templateId));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getClinicalCategoryTemplate(category) {
  const legacyCategoryKey = getLegacyClinicalCategoryKey(category);
  const sourceTemplateId = legacyCategoryKey
    ? CLINICAL_CATEGORY_SOURCE_TEMPLATE[legacyCategoryKey]
    : null;

  return officialTemplates[sourceTemplateId] || officialTemplates.clinica_medica || null;
}

function normalizeSections(value) {
  const rawSections = Array.isArray(value)
    ? value
    : String(value || '').split(/\r?\n/g);

  const sections = [];
  const seen = new Set();

  rawSections.forEach((item) => {
    const section = normalizeText(item).slice(0, MAX_SECTION_LENGTH);
    const normalizedKey = section
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!section || seen.has(normalizedKey)) {
      return;
    }

    seen.add(normalizedKey);
    sections.push(section);
  });

  return sections.slice(0, MAX_SECTIONS);
}

function validateTemplatePayload(payload) {
  const name = normalizeText(payload?.name || payload?.nome).slice(0, MAX_TEMPLATE_NAME_LENGTH);
  const description = normalizeText(payload?.description).slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH);
  const sections = normalizeSections(payload?.sections || payload?.secoes);
  const category = resolveCategory({
    key: payload?.clinicalCategoryKey || payload?.clinical_category_key || payload?.clinicalCategory,
    label: payload?.clinicalCategoryLabel || payload?.clinical_category_label,
    legacyValue: payload?.clinicalCategory || payload?.clinical_category,
  });

  if (!name) {
    const error = new Error('Informe um nome para o template.');
    error.statusCode = 400;
    throw error;
  }

  if (sections.length < 2) {
    const error = new Error('Informe pelo menos duas seções para o template.');
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    description,
    sections,
    clinicalCategoryKey: category.key,
    clinicalCategoryLabel: category.label,
  };
}

function slugifySection(value, index) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return slug || `secao_${index + 1}`;
}

function getSectionPriority(label, index) {
  const normalized = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/(queixa|historia|molestia|evolucao|exame fisico|sinais vitais|gravidade)/.test(normalized)) {
    return 'essential';
  }

  if (index <= 1 || /(identificacao|antecedente|medicacao|medicacoes|alergia|doenca|comorbidade)/.test(normalized)) {
    return 'important';
  }

  return 'contextual';
}

function buildCustomEvaluation(sections, inheritedEvaluation = null) {
  const baseWeight = Number((100 / sections.length).toFixed(1));
  let accumulatedWeight = 0;
  const severitySignals =
    Array.isArray(inheritedEvaluation?.severitySignals) && inheritedEvaluation.severitySignals.length
      ? inheritedEvaluation.severitySignals
      : ['dispneia', 'dor toracica', 'dor torácica', 'sangramento', 'convulsao', 'convulsão'];

  return {
    sensitivity: inheritedEvaluation?.sensitivity || 'custom',
    severitySignals,
    sections: sections.map((label, index) => {
      const isLast = index === sections.length - 1;
      const weight = isLast ? Number((100 - accumulatedWeight).toFixed(1)) : baseWeight;
      accumulatedWeight += weight;
      const normalizedLabel = String(label || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return {
        id: slugifySection(label, index),
        label,
        weight,
        priority: getSectionPriority(label, index),
        aliases: [label, normalizedLabel].filter(Boolean),
        evidence: normalizedLabel.split(/[^a-z0-9]+/g).filter((item) => item.length > 3).slice(0, 6),
        narrative: /(historia|molestia|evolucao|hda|hma)/.test(normalizedLabel),
        vitals: /(exame fisico|sinais vitais|vital)/.test(normalizedLabel),
      };
    }),
  };
}

function mapTemplateRow(row) {
  const sections = normalizeSections(row?.sections);
  const category = resolveCategory({
    key: row?.clinical_category_key,
    label: row?.clinical_category_label,
    legacyValue: row?.clinical_category,
  });

  return {
    id: formatCustomTemplateId(row.id),
    nome: row.name,
    description: row.description || '',
    secoes: sections,
    clinicalCategory: category.key,
    clinicalCategoryKey: category.key,
    clinicalCategoryLabel: category.label,
    clinical_category: row?.clinical_category || null,
    clinical_category_key: category.key,
    clinical_category_label: category.label,
    source: 'custom',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildRuntimeTemplateConfig(row) {
  const sections = normalizeSections(row?.sections);

  if (!row?.name || sections.length < 2) {
    return null;
  }

  const category = resolveCategory({
    key: row?.clinical_category_key,
    label: row?.clinical_category_label,
    legacyValue: row?.clinical_category,
  });
  const categoryTemplate = getClinicalCategoryTemplate(
    row?.clinical_category || getLegacyClinicalCategoryKeyByCategoryKey(category.key),
  );

  return {
    nome: row.name,
    secoes: sections,
    promptVariant: categoryTemplate?.promptVariant || 'custom',
    sectionGuidance: categoryTemplate?.sectionGuidance,
    evaluation: buildCustomEvaluation(sections, categoryTemplate?.evaluation),
    clinicalCategory: category.key,
    clinicalCategoryKey: category.key,
    clinicalCategoryLabel: category.label,
  };
}

async function requestUserTemplates(path, options = {}) {
  const { url, serviceRoleKey } = getUserTemplatesAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Armazenamento de templates indisponível.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/user_templates${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error('Não foi possível acessar seus templates.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listUserTemplates(userId) {
  if (!isValidUserId(userId) || !isUserTemplatesStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,user_id,name,description,sections,clinical_category,clinical_category_key,clinical_category_label,created_at,updated_at',
    user_id: `eq.${userId}`,
    order: 'updated_at.desc',
  });
  const json = await requestUserTemplates(`?${query.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json.map(mapTemplateRow).filter(Boolean) : [];
}

async function getUserTemplateConfig(templateId, userId) {
  const rowId = parseCustomTemplateId(templateId);

  if (!rowId || !isValidUserId(userId) || !isUserTemplatesStorageAvailable()) {
    return null;
  }

  const query = new URLSearchParams({
    select: 'id,user_id,name,description,sections,clinical_category,clinical_category_key,clinical_category_label,created_at,updated_at',
    id: `eq.${rowId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const json = await requestUserTemplates(`?${query.toString()}`, { method: 'GET' });
  const row = Array.isArray(json) ? json[0] : null;

  return buildRuntimeTemplateConfig(row);
}

async function createUserTemplate(userId, payload) {
  if (!isValidUserId(userId)) {
    const error = new Error('Sessão obrigatória para criar templates.');
    error.statusCode = 401;
    throw error;
  }

  const fields = validateTemplatePayload(payload);
  const json = await requestUserTemplates('', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      name: fields.name,
      description: fields.description || null,
      sections: fields.sections,
      clinical_category: getLegacyClinicalCategoryKeyByCategoryKey(fields.clinicalCategoryKey),
      clinical_category_key: fields.clinicalCategoryKey,
      clinical_category_label: fields.clinicalCategoryLabel,
    }),
  });

  return Array.isArray(json) && json[0] ? mapTemplateRow(json[0]) : null;
}

async function updateUserTemplate(userId, templateId, payload) {
  const rowId = parseCustomTemplateId(templateId);

  if (!rowId || !isValidUserId(userId)) {
    const error = new Error('Template inválido.');
    error.statusCode = 400;
    throw error;
  }

  const fields = validateTemplatePayload(payload);
  const query = new URLSearchParams({
    id: `eq.${rowId}`,
    user_id: `eq.${userId}`,
  });
  const json = await requestUserTemplates(`?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: fields.name,
      description: fields.description || null,
      sections: fields.sections,
      clinical_category: getLegacyClinicalCategoryKeyByCategoryKey(fields.clinicalCategoryKey),
      clinical_category_key: fields.clinicalCategoryKey,
      clinical_category_label: fields.clinicalCategoryLabel,
    }),
  });

  if (!Array.isArray(json) || !json[0]) {
    const error = new Error('Template não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return mapTemplateRow(json[0]);
}

async function deleteUserTemplate(userId, templateId) {
  const rowId = parseCustomTemplateId(templateId);

  if (!rowId || !isValidUserId(userId)) {
    const error = new Error('Template inválido.');
    error.statusCode = 400;
    throw error;
  }

  const query = new URLSearchParams({
    id: `eq.${rowId}`,
    user_id: `eq.${userId}`,
  });

  await requestUserTemplates(`?${query.toString()}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });

  return true;
}

module.exports = {
  buildCustomEvaluation,
  CLINICAL_CATEGORY_SOURCE_TEMPLATE,
  createUserTemplate,
  deleteUserTemplate,
  getUserTemplateConfig,
  isCustomTemplateId,
  listUserTemplates,
  parseCustomTemplateId,
  updateUserTemplate,
};
