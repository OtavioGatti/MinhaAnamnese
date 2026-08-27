// Busca na tabela CID-10 oficial (DATASUS), importada por
// tools/import_cid10_supabase.py. E uma referencia pesquisavel pelo medico —
// o mesmo papel do Bulario — e nunca uma sugestao da IA: quem escolhe o codigo
// e sempre a pessoa.
//
// O medico raramente digita o termo tecnico que o DATASUS usa: ele busca
// "dislipidemia" e a tabela diz "Disturbios do metabolismo de lipoproteinas".
// Por isso a busca tem tres camadas, em cascata, da mais barata para a mais
// cara — cada uma so roda se a anterior nao resolveu:
//   1. SQL (search_cid10_codes): texto literal e, se vier fraco, parecenca por
//      trigrama. Ver supabase/cid10_codes.sql.
//   2. Dicionario de sinonimos curado, para quando as palavras sao totalmente
//      diferentes ("pressao alta" -> "hipertensao").
//   3. IA sugerindo outros nomes para a mesma condicao.
// Em todas elas o que a IA/dicionario produz e so um TERMO DE BUSCA: os codigos
// exibidos saem sempre da tabela oficial.

const { expandCid10Query } = require('./cid10SynonymDictionary');
const { expandCid10QueryWithAi } = require('./cid10QueryExpansionAi');

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
// Abaixo disso a busca "nao resolveu" e vale acionar a proxima camada.
const WEAK_RESULT_THRESHOLD = 3;
// Termos comuns ("infeccao", "aguda") passam de 200 linhas. A janela do
// fallback precisa ser larga o bastante para o reordenamento ter o que escolher.
const FALLBACK_FETCH_WINDOW = 200;

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

function isMissingFunctionError(error) {
  const body = String(error?.responseBody || '');
  return error?.statusCode === 404
    && (body.includes('PGRST202') || body.toLowerCase().includes('could not find the function'));
}

// Caminho preferido: o ranking roda no banco, que enxerga todas as linhas.
async function searchViaRpc(normalizedQuery, normalizedLimit) {
  const params = new URLSearchParams({ select: CID10_SELECT });
  const json = await requestCid10(`rpc/search_cid10_codes?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify({
      search_query: normalizedQuery,
      max_results: normalizedLimit,
    }),
  });

  return Array.isArray(json) ? json.map(mapCid10Row).filter(Boolean) : [];
}

// Usado enquanto a função do Supabase não estiver aplicada (o SQL é manual).
// Ordena pelo código e reordena no processo, então perde relevância quando o
// termo tem muito resultado — por isso a janela buscada é bem maior que o
// limite pedido.
async function searchViaTableScan(normalizedQuery, normalizedLimit) {
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
    limit: String(FALLBACK_FETCH_WINDOW),
  });

  const json = await requestCid10(`cid10_codes?${params.toString()}`, { method: 'GET' });
  const results = Array.isArray(json) ? json.map(mapCid10Row).filter(Boolean) : [];

  return rankCid10Results(results, normalizedQuery).slice(0, normalizedLimit);
}

async function runSearch(normalizedQuery, normalizedLimit) {
  try {
    return await searchViaRpc(normalizedQuery, normalizedLimit);
  } catch (error) {
    if (!isMissingFunctionError(error)) {
      throw error;
    }

    console.warn('cid10: search_cid10_codes ausente no Supabase, usando busca sem ranking do banco.');
    return searchViaTableScan(normalizedQuery, normalizedLimit);
  }
}

// O que o termo digitado achou vem sempre primeiro; os termos alternativos so
// preenchem o que sobrou. Dedupe por codigo para o mesmo CID nao repetir quando
// dois termos chegam nele.
function mergeResults(base, extra, limit) {
  const seen = new Set(base.map((item) => item.code));
  const merged = [...base];

  for (const item of extra) {
    if (merged.length >= limit) {
      break;
    }

    if (!seen.has(item.code)) {
      seen.add(item.code);
      merged.push(item);
    }
  }

  return merged;
}

async function searchWithAlternateTerms(terms, results, normalizedLimit) {
  let merged = results;

  for (const term of terms) {
    if (merged.length >= normalizedLimit) {
      break;
    }

    const alternate = await runSearch(normalizeQuery(term), normalizedLimit);
    merged = mergeResults(merged, alternate, normalizedLimit);
  }

  return merged;
}

// Busca por codigo ("n30", "E78.5") nao precisa de sinonimo nem de IA: o medico
// ja sabe o que quer e so digitou o comeco.
function looksLikeCodeSearch(normalizedQuery) {
  return /\d/.test(normalizedQuery);
}

// Aceita boolean ou funcao: quem chama pode adiar um custo (cota, rate limit)
// para o momento em que a camada de IA e realmente necessaria.
async function resolveAiExpansionAllowed(allowAiExpansion) {
  if (typeof allowAiExpansion !== 'function') {
    return Boolean(allowAiExpansion);
  }

  try {
    return Boolean(await allowAiExpansion());
  } catch (_error) {
    return false;
  }
}

async function searchCid10Codes({
  query = '',
  limit = DEFAULT_SEARCH_LIMIT,
  allowAiExpansion = false,
} = {}) {
  const normalizedQuery = normalizeQuery(query);

  if (!isCid10StorageAvailable() || normalizedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const normalizedLimit = normalizeLimit(limit);
  let results = await runSearch(normalizedQuery, normalizedLimit);

  if (looksLikeCodeSearch(normalizedQuery)) {
    return results;
  }

  // O dicionario roda mesmo com a busca literal cheia, e o que ele acha vem NA
  // FRENTE: estar no dicionario e uma decisao humana de que aquele termo aponta
  // para determinada condicao, o que vale mais que casar por substring. "ITU"
  // casa com "tinnitus" e "carcinoma in situ" e encheria a tela de ruido antes
  // de chegar em cistite; "derrame" acha derrame pleural sozinho, mas quem
  // digita isso costuma querer AVC. O resultado literal continua logo abaixo.
  const synonyms = expandCid10Query(normalizedQuery);

  if (synonyms.length > 0) {
    const fromSynonyms = await searchWithAlternateTerms(synonyms, [], normalizedLimit);
    results = mergeResults(fromSynonyms, results, normalizedLimit);
  }

  if (results.length >= WEAK_RESULT_THRESHOLD || !(await resolveAiExpansionAllowed(allowAiExpansion))) {
    return results;
  }

  // Best-effort: sem chave, com a flag desligada ou em erro, devolve [] e a
  // busca fica com o que ja tinha.
  const aiTerms = await expandCid10QueryWithAi(normalizedQuery);

  return aiTerms.length > 0
    ? searchWithAlternateTerms(aiTerms, results, normalizedLimit)
    : results;
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
  WEAK_RESULT_THRESHOLD,
  buildCodeKeyQuery,
  getCid10CodeByCode,
  isCid10StorageAvailable,
  looksLikeCodeSearch,
  mapCid10Row,
  mergeResults,
  normalizeQuery,
  rankCid10Results,
  searchCid10Codes,
};
