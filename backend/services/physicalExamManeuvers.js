// Catálogo de manobras de exame físico (Giordano, gaveta anterior, Murphy...).
// Conteúdo editorial revisado, sincronizado do Notion.
//
// A IA nomeia a manobra dentro da hipótese diagnóstica; a técnica e a
// interpretação do achado vêm sempre daqui. Um nome que não casa com o catálogo
// nunca vira conteúdo clínico — vira backlog editorial (unmatchedManeuvers.js).

const {
  buildAliasKeys,
  buildCatalogSearchName,
  findExactAliasMatch,
} = require('../utils/clinicalAliasMatching');

const MAX_SEARCH_RESULTS = 60;
const MAX_QUERY_LENGTH = 80;
const HIDDEN_REVIEW_STATUS = 'Não usar sem validação';

const MANEUVER_SELECT = [
  'id',
  'slug',
  'name',
  'aliases',
  'category',
  'related_conditions',
  'when_to_perform',
  'how_to_perform',
  'positive_finding',
  'negative_finding',
  'clinical_utility',
  'source',
  'review_status',
  'display_order',
  'updated_at',
].join(',');

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isPhysicalExamManeuversStorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function sanitizeQuery(value) {
  // Vírgula e parênteses são sintaxe do filtro `or=` do PostgREST.
  return normalizeText(value).replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return MAX_SEARCH_RESULTS;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_RESULTS);
}

function mapManeuverRow(row) {
  if (!row?.slug || !row?.name) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    aliases: normalizeText(row.aliases),
    category: normalizeText(row.category),
    relatedConditions: normalizeText(row.related_conditions),
    whenToPerform: normalizeLongText(row.when_to_perform),
    howToPerform: normalizeLongText(row.how_to_perform),
    positiveFinding: normalizeLongText(row.positive_finding),
    negativeFinding: normalizeLongText(row.negative_finding),
    clinicalUtility: normalizeLongText(row.clinical_utility),
    source: normalizeText(row.source),
    reviewStatus: normalizeText(row.review_status),
    displayOrder: Number.isFinite(Number(row.display_order)) ? Number(row.display_order) : 1000,
    updatedAt: row.updated_at || null,
  };
}

// Chaves sob as quais a manobra pode ser encontrada: o nome, os sinônimos e o
// slug. `related_conditions` fica de fora de propósito — casar pelo nome da
// condição traria a manobra de qualquer hipótese homônima.
function buildManeuverAliasKeys(maneuver) {
  return buildAliasKeys([
    maneuver?.name,
    maneuver?.aliases,
    String(maneuver?.slug || '').replace(/-/g, ' '),
  ]);
}

async function requestManeuvers(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Catálogo de manobras indisponível.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Não foi possível acessar o catálogo de manobras.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildBaseParams({ limit = MAX_SEARCH_RESULTS } = {}) {
  return new URLSearchParams({
    select: MANEUVER_SELECT,
    status: 'eq.published',
    active: 'is.true',
    // Conteúdo não validado não chega ao médico, mesmo publicado por engano.
    review_status: `neq.${HIDDEN_REVIEW_STATUS}`,
    order: 'display_order.asc,name.asc',
    limit: String(normalizeLimit(limit)),
  });
}

async function listPhysicalExamManeuvers({ query = '', category = '', limit = MAX_SEARCH_RESULTS } = {}) {
  if (!isPhysicalExamManeuversStorageAvailable()) {
    return [];
  }

  const params = buildBaseParams({ limit });
  const term = sanitizeQuery(query);

  if (term) {
    params.set('or', `(name.ilike.*${term}*,aliases.ilike.*${term}*,related_conditions.ilike.*${term}*,category.ilike.*${term}*)`);
  }

  if (category) {
    params.set('category', `eq.${normalizeText(category)}`);
  }

  const json = await requestManeuvers(`physical_exam_maneuvers?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json.map(mapManeuverRow).filter(Boolean) : [];
}

async function getPhysicalExamManeuverBySlug(slug) {
  const normalizedSlug = normalizeText(slug);

  if (!normalizedSlug || !isPhysicalExamManeuversStorageAvailable()) {
    return null;
  }

  const params = buildBaseParams({ limit: 1 });
  params.set('slug', `eq.${normalizedSlug}`);

  const json = await requestManeuvers(`physical_exam_maneuvers?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) && json[0] ? mapManeuverRow(json[0]) : null;
}

// Só os nomes publicados, para injetar como referência no prompt de hipóteses:
// vendo a grafia que o catálogo usa, o modelo copia em vez de adivinhar.
async function listManeuverNamesForPrompt(limit = MAX_SEARCH_RESULTS) {
  if (!isPhysicalExamManeuversStorageAvailable()) {
    return [];
  }

  const params = new URLSearchParams({
    select: 'name',
    status: 'eq.published',
    active: 'is.true',
    review_status: `neq.${HIDDEN_REVIEW_STATUS}`,
    order: 'display_order.asc,name.asc',
    limit: String(normalizeLimit(limit)),
  });

  const json = await requestManeuvers(`physical_exam_maneuvers?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json.map((row) => normalizeText(row?.name)).filter(Boolean) : [];
}

// Referência enxuta anexada à hipótese. Igual ao guia de prescrição: o conteúdo
// clínico vem do catálogo revisado, nunca do modelo.
function buildManeuverRef(match) {
  if (!match?.slug) {
    return null;
  }

  return {
    slug: match.slug,
    name: match.name,
    category: match.category,
    whenToPerform: match.whenToPerform,
    howToPerform: match.howToPerform,
    positiveFinding: match.positiveFinding,
    negativeFinding: match.negativeFinding,
    clinicalUtility: match.clinicalUtility,
    source: match.source,
  };
}

async function findManeuverByName(maneuverName) {
  const normalizedName = normalizeText(maneuverName);

  if (!normalizedName || !isPhysicalExamManeuversStorageAvailable()) {
    return null;
  }

  const candidates = await listPhysicalExamManeuvers({
    query: buildCatalogSearchName(normalizedName),
    limit: 12,
  });
  const match = findExactAliasMatch(normalizedName, candidates, buildManeuverAliasKeys);

  return buildManeuverRef(match);
}

module.exports = {
  HIDDEN_REVIEW_STATUS,
  buildManeuverAliasKeys,
  buildManeuverRef,
  findManeuverByName,
  getPhysicalExamManeuverBySlug,
  isPhysicalExamManeuversStorageAvailable,
  listManeuverNamesForPrompt,
  listPhysicalExamManeuvers,
  mapManeuverRow,
};
