// Catálogo de exames complementares (hemograma, EAS, PCR, RX de tórax...).
// Conteúdo editorial revisado, sincronizado do Notion.
//
// A IA nomeia o exame dentro da hipótese diagnóstica; COMO interpretar vem
// sempre daqui. Um nome que não casa com o catálogo nunca vira conteúdo
// clínico — vira backlog editorial (unmatchedExams.js).

const {
  buildAliasKeys,
  buildCatalogSearchName,
  findExactAliasMatch,
} = require('../utils/clinicalAliasMatching');

const MAX_SEARCH_RESULTS = 60;
const MAX_QUERY_LENGTH = 80;
const HIDDEN_REVIEW_STATUS = 'Não usar sem validação';

// Aviso de segurança do catálogo. Fica no CÓDIGO, não no CMS: faixa de
// referência variar por laboratório é regra clínica, não texto editorial —
// uma edição no Notion não pode remover isso da tela.
const EXAM_REFERENCE_DISCLAIMER = 'Faixas de referência variam por laboratório, método de análise, idade, sexo e gestação. O que está aqui é orientação geral — o intervalo do laudo do seu laboratório sempre prevalece.';

const EXAM_SELECT = [
  'id',
  'slug',
  'name',
  'aliases',
  'category',
  'related_conditions',
  'when_to_request',
  'preparation',
  'how_to_interpret',
  'limitations',
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

function isDiagnosticExamsStorageAvailable() {
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
  return normalizeText(value).replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return MAX_SEARCH_RESULTS;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_RESULTS);
}

function mapExamRow(row) {
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
    whenToRequest: normalizeLongText(row.when_to_request),
    preparation: normalizeLongText(row.preparation),
    howToInterpret: normalizeLongText(row.how_to_interpret),
    limitations: normalizeLongText(row.limitations),
    source: normalizeText(row.source),
    reviewStatus: normalizeText(row.review_status),
    displayOrder: Number.isFinite(Number(row.display_order)) ? Number(row.display_order) : 1000,
    updatedAt: row.updated_at || null,
  };
}

// `related_conditions` fica de fora das chaves: casar pelo nome da condição
// traria o exame de qualquer hipótese homônima.
function buildExamAliasKeys(exam) {
  return buildAliasKeys([
    exam?.name,
    exam?.aliases,
    String(exam?.slug || '').replace(/-/g, ' '),
  ]);
}

async function requestExams(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Catálogo de exames indisponível.');
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
    const error = new Error('Não foi possível acessar o catálogo de exames.');
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
    select: EXAM_SELECT,
    status: 'eq.published',
    active: 'is.true',
    review_status: `neq.${HIDDEN_REVIEW_STATUS}`,
    order: 'display_order.asc,name.asc',
    limit: String(normalizeLimit(limit)),
  });
}

async function listDiagnosticExams({ query = '', category = '', limit = MAX_SEARCH_RESULTS } = {}) {
  if (!isDiagnosticExamsStorageAvailable()) {
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

  const json = await requestExams(`diagnostic_exams?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json.map(mapExamRow).filter(Boolean) : [];
}

async function getDiagnosticExamBySlug(slug) {
  const normalizedSlug = normalizeText(slug);

  if (!normalizedSlug || !isDiagnosticExamsStorageAvailable()) {
    return null;
  }

  const params = buildBaseParams({ limit: 1 });
  params.set('slug', `eq.${normalizedSlug}`);

  const json = await requestExams(`diagnostic_exams?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) && json[0] ? mapExamRow(json[0]) : null;
}

// Só os nomes publicados, para injetar como referência de grafia no prompt de
// hipóteses — mesma ideia das manobras.
async function listExamNamesForPrompt(limit = MAX_SEARCH_RESULTS) {
  if (!isDiagnosticExamsStorageAvailable()) {
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

  const json = await requestExams(`diagnostic_exams?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json.map((row) => normalizeText(row?.name)).filter(Boolean) : [];
}

function buildExamRef(match) {
  if (!match?.slug) {
    return null;
  }

  return {
    slug: match.slug,
    name: match.name,
    category: match.category,
  };
}

async function findExamByName(examName) {
  const normalizedName = normalizeText(examName);

  if (!normalizedName || !isDiagnosticExamsStorageAvailable()) {
    return null;
  }

  const candidates = await listDiagnosticExams({
    query: buildCatalogSearchName(normalizedName),
    limit: 12,
  });
  const match = findExactAliasMatch(normalizedName, candidates, buildExamAliasKeys);

  return buildExamRef(match);
}

module.exports = {
  EXAM_REFERENCE_DISCLAIMER,
  HIDDEN_REVIEW_STATUS,
  buildExamAliasKeys,
  buildExamRef,
  findExamByName,
  getDiagnosticExamBySlug,
  isDiagnosticExamsStorageAvailable,
  listDiagnosticExams,
  listExamNamesForPrompt,
  mapExamRow,
};
