const { isValidUserId } = require('../utils/idValidation');
const officialTemplates = require('../templates/templates');
const {
  getLegacyClinicalCategoryKey,
  getLegacyClinicalCategoryKeyByCategoryKey,
  resolveCategory,
} = require('../utils/categoryKeys');
const { matchOfficialSection } = require('../utils/templateSectionMatching');
const { enrichCustomTemplate } = require('./enrichCustomTemplate');

// Pesos-base por prioridade clínica (renormalizados para somar ~100).
const PRIORITY_BASE_WEIGHT = {
  essential: 18,
  important: 10,
  contextual: 5,
  optional: 2,
};

function dedupeStrings(values, max) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const normalized = String(value || '').trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);

    if (output.length >= max) {
      break;
    }
  }

  return output;
}

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

// Deriva o "material clínico" de uma seção custom em ordem de qualidade:
// 1) enriquecimento por IA salvo (D); 2) herança da seção oficial mais próxima
// (A); 3) heurística a partir do próprio rótulo (fallback).
function resolveSectionMaterial(label, index, { officialSections, enrichmentByLabel }) {
  const normalizedLabel = String(label || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const enrichment = enrichmentByLabel.get(normalizedLabel);
  const officialMatch = matchOfficialSection(label, officialSections);

  const heuristicEvidence = normalizedLabel.split(/[^a-z0-9]+/g).filter((item) => item.length > 3).slice(0, 6);
  const priority = enrichment?.priority || officialMatch?.priority || getSectionPriority(label, index);
  const aliases = dedupeStrings(
    [label, ...(enrichment?.aliases || []), ...(officialMatch?.aliases || []), normalizedLabel],
    10,
  );
  const evidence = dedupeStrings(
    [...(enrichment?.evidence || []), ...(officialMatch?.evidence || []), ...heuristicEvidence],
    12,
  );

  return {
    id: slugifySection(label, index),
    label,
    priority,
    aliases,
    evidence,
    narrative: Boolean(officialMatch?.narrative) || /(historia|molestia|evolucao|hda|hma)/.test(normalizedLabel),
    vitals: Boolean(officialMatch?.vitals) || /(exame fisico|sinais vitais|vital)/.test(normalizedLabel),
  };
}

function buildCustomEvaluation(sections, inheritedEvaluation = null, enrichment = null) {
  const officialSections = Array.isArray(inheritedEvaluation?.sections) ? inheritedEvaluation.sections : [];
  const enrichmentByLabel = new Map(
    (Array.isArray(enrichment?.sections) ? enrichment.sections : []).map((item) => [
      String(item?.label || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase(),
      item,
    ]),
  );
  const severitySignals =
    (Array.isArray(enrichment?.severitySignals) && enrichment.severitySignals.length && enrichment.severitySignals) ||
    (Array.isArray(inheritedEvaluation?.severitySignals) && inheritedEvaluation.severitySignals.length && inheritedEvaluation.severitySignals) ||
    ['dispneia', 'dor toracica', 'dor torácica', 'sangramento', 'convulsao', 'convulsão'];

  const materials = sections.map((label, index) =>
    resolveSectionMaterial(label, index, { officialSections, enrichmentByLabel }));

  // Peso por prioridade clínica, renormalizado para somar 100.
  const rawWeights = materials.map((material) => PRIORITY_BASE_WEIGHT[material.priority] || PRIORITY_BASE_WEIGHT.contextual);
  const totalRaw = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  let accumulatedWeight = 0;

  return {
    sensitivity: inheritedEvaluation?.sensitivity || 'custom',
    severitySignals,
    sections: materials.map((material, index) => {
      const isLast = index === materials.length - 1;
      const weight = isLast
        ? Number((100 - accumulatedWeight).toFixed(1))
        : Number(((rawWeights[index] / totalRaw) * 100).toFixed(1));
      accumulatedWeight += weight;

      return {
        id: material.id,
        label: material.label,
        weight,
        priority: material.priority,
        aliases: material.aliases,
        evidence: material.evidence,
        narrative: material.narrative,
        vitals: material.vitals,
      };
    }),
  };
}

// Remapeia a orientação clínica oficial (chaveada pelos rótulos oficiais) para
// os rótulos custom do usuário, para o prompt de organização não perder a
// orientação por seção. Enriquecimento por IA tem precedência.
function buildCustomSectionGuidance(sections, officialEvaluation, officialGuidance, enrichment) {
  const officialSections = Array.isArray(officialEvaluation?.sections) ? officialEvaluation.sections : [];
  const enrichmentByLabel = new Map(
    (Array.isArray(enrichment?.sections) ? enrichment.sections : []).map((item) => [
      String(item?.label || '').trim().toLowerCase(),
      item,
    ]),
  );
  const guidance = {};

  sections.forEach((label) => {
    const enriched = enrichmentByLabel.get(String(label).trim().toLowerCase());

    if (Array.isArray(enriched?.guidance) && enriched.guidance.length) {
      guidance[label] = enriched.guidance;
      return;
    }

    const officialMatch = matchOfficialSection(label, officialSections);
    const officialLines = officialMatch && officialGuidance ? officialGuidance[officialMatch.label] : null;

    if (Array.isArray(officialLines) && officialLines.length) {
      guidance[label] = officialLines;
    }
  });

  return Object.keys(guidance).length ? guidance : null;
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
  const enrichment = normalizeStoredEnrichment(row?.enrichment);

  return {
    nome: row.name,
    secoes: sections,
    promptVariant: categoryTemplate?.promptVariant || 'custom',
    // Guidance remapeada para os rótulos do usuário (senão o prompt não a acha).
    sectionGuidance: buildCustomSectionGuidance(
      sections,
      categoryTemplate?.evaluation,
      categoryTemplate?.sectionGuidance,
      enrichment,
    ),
    evaluation: buildCustomEvaluation(sections, categoryTemplate?.evaluation, enrichment),
    clinicalCategory: category.key,
    clinicalCategoryKey: category.key,
    clinicalCategoryLabel: category.label,
  };
}

function normalizeStoredEnrichment(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.sections)) {
    return null;
  }

  return value;
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

  // select=* para incluir a coluna enrichment quando existir, sem quebrar
  // enquanto o SQL não foi aplicado (PostgREST não erra em coluna ausente aqui).
  const query = new URLSearchParams({
    select: '*',
    id: `eq.${rowId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const json = await requestUserTemplates(`?${query.toString()}`, { method: 'GET' });
  const row = Array.isArray(json) ? json[0] : null;

  return buildRuntimeTemplateConfig(row);
}

// Best-effort: enriquece o template com IA e grava na coluna enrichment.
// Falha (IA indisponível / coluna ausente antes do SQL) não quebra o save.
async function persistTemplateEnrichment(rowId, userId, fields) {
  try {
    const enrichment = await enrichCustomTemplate({
      name: fields.name,
      categoryLabel: fields.clinicalCategoryLabel,
      sections: fields.sections,
    });

    if (!enrichment) {
      return;
    }

    const query = new URLSearchParams({ id: `eq.${rowId}`, user_id: `eq.${userId}` });
    await requestUserTemplates(`?${query.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ enrichment }),
    });
  } catch (_error) {
    // Silencioso de propósito: enriquecimento é opcional.
  }
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

  const row = Array.isArray(json) && json[0] ? json[0] : null;

  if (!row) {
    return null;
  }

  await persistTemplateEnrichment(row.id, userId, fields);

  return mapTemplateRow(row);
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

  await persistTemplateEnrichment(rowId, userId, fields);

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
