// Busca na tabela CID-10 oficial (DATASUS), importada por
// tools/import_cid10_supabase.py. E uma referencia pesquisavel pelo medico —
// o mesmo papel do Bulario — e nunca uma sugestao da IA: quem escolhe o codigo
// e sempre a pessoa.

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

const CID10_SELECT = [
  'code',
  'code_key',
  'description',
  'category_code',
  'chapter_number',
  'chapter_description',
  'group_description',
  'level',
  'sex_restriction',
  'dagger_asterisk',
].join(',');

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isCid10StorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Deixa passar so o que faz sentido num codigo ou num termo clinico. Alem de
// higienizar a entrada, evita que virgula ou parenteses quebrem o filtro `or=`
// do PostgREST, que usa esses caracteres como sintaxe.
function normalizeQuery(value) {
  return stripAccents(value)
    .replace(/[^a-zA-Z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_LIMIT);
}

// "n30.0" e "n300" apontam para a mesma linha: o code_key nao tem ponto.
function buildCodeKeyQuery(query) {
  return query.replace(/[.\s]/g, '').toUpperCase();
}

function mapCid10Row(row) {
  if (!row?.code || !row?.description) {
    return null;
  }

  return {
    code: row.code,
    description: row.description,
    categoryCode: row.category_code || '',
    chapterNumber: row.chapter_number ?? null,
    chapterDescription: row.chapter_description || '',
    groupDescription: row.group_description || '',
    level: row.level || 'subcategoria',
    sexRestriction: row.sex_restriction || '',
    // '*' marca codigo de manifestacao, que nao deve ser usado sozinho como
    // diagnostico principal. O frontend avisa quando aparece.
    daggerAsterisk: row.dagger_asterisk || '',
  };
}

async function requestCid10(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Tabela CID-10 indisponível.');
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
    const error = new Error('Não foi possível consultar a tabela CID-10.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// O PostgREST devolve na ordem do banco; quem sabe o que o medico quis e o
// formato do que ele digitou. Codigo exato primeiro, depois prefixo de codigo,
// depois quem comeca com o termo — "cistite" antes de "outras cistites".
function rankCid10Results(results, query) {
  const codeQuery = buildCodeKeyQuery(query);
  const termQuery = stripAccents(query).toLowerCase().trim();

  function scoreOf(item) {
    const codeKey = buildCodeKeyQuery(item.code);
    const description = stripAccents(item.description).toLowerCase();

    if (codeKey === codeQuery) {
      return 0;
    }

    if (codeQuery && codeKey.startsWith(codeQuery)) {
      return 1;
    }

    if (termQuery && description.startsWith(termQuery)) {
      return 2;
    }

    return 3;
  }

  return results
    .map((item, index) => ({ item, index, score: scoreOf(item) }))
    .sort((a, b) => (a.score - b.score) || (a.index - b.index))
    .map((entry) => entry.item);
}

async function searchCid10Codes({ query = '', limit = DEFAULT_SEARCH_LIMIT } = {}) {
  const normalizedQuery = normalizeQuery(query);

  if (!isCid10StorageAvailable() || normalizedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const normalizedLimit = normalizeLimit(limit);
  const codeQuery = buildCodeKeyQuery(normalizedQuery);
  const termQuery = normalizedQuery.toLowerCase();
  const filters = [`search_text.like.*${termQuery}*`];

  if (codeQuery) {
    filters.unshift(`code_key.like.${codeQuery}*`);
  }

  const params = new URLSearchParams({
    select: CID10_SELECT,
    or: `(${filters.join(',')})`,
    order: 'code_key.asc',
    // Busca um pouco alem do limite para o reordenamento ter margem de escolha.
    limit: String(Math.min(normalizedLimit * 3, MAX_SEARCH_LIMIT * 3)),
  });

  const json = await requestCid10(`cid10_codes?${params.toString()}`, { method: 'GET' });
  const results = Array.isArray(json) ? json.map(mapCid10Row).filter(Boolean) : [];

  return rankCid10Results(results, normalizedQuery).slice(0, normalizedLimit);
}

async function getCid10CodeByCode(code) {
  const codeKey = buildCodeKeyQuery(normalizeQuery(code));

  if (!isCid10StorageAvailable() || !codeKey) {
    return null;
  }

  const params = new URLSearchParams({
    select: CID10_SELECT,
    code_key: `eq.${codeKey}`,
    limit: '1',
  });

  const json = await requestCid10(`cid10_codes?${params.toString()}`, { method: 'GET' });

  return Array.isArray(json) && json[0] ? mapCid10Row(json[0]) : null;
}

module.exports = {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MIN_QUERY_LENGTH,
  buildCodeKeyQuery,
  getCid10CodeByCode,
  isCid10StorageAvailable,
  mapCid10Row,
  normalizeQuery,
  rankCid10Results,
  searchCid10Codes,
};
