// Escrita no Notion da database "Protocolos de Prescrição - CMS".
//
// Primeira via de ESCRITA no Notion do backend. Monta os payloads de
// propriedade conforme o tipo real de cada campo (title/rich_text/select/
// multi_select/checkbox/date), respeitando o limite de 2000 caracteres por
// objeto de texto do Notion, e atualiza a página. Também consulta páginas por
// status_automacao e lê os campos atuais de uma página (para a correção).

const {
  getNotionProtocolsConfig,
  requestNotion,
  retrieveProtocolDataSource,
} = require('./notionProtocolSchema');

const NOTION_TEXT_LIMIT = 2000; // limite do Notion por objeto de texto
const WRITABLE_TYPES = new Set([
  'title',
  'rich_text',
  'select',
  'multi_select',
  'checkbox',
  'date',
  'number',
]);

let cachedTypeMap = null;

// Quebra um texto longo em pedaços <= 2000 chars, preferindo cortar em quebras
// de linha e preservando TODOS os caracteres (concatenação reproduz o original).
function chunkText(text, size = NOTION_TEXT_LIMIT) {
  const value = String(text == null ? '' : text);

  if (!value) {
    return [];
  }

  if (value.length <= size) {
    return [value];
  }

  const chunks = [];
  let rest = value;

  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut <= 0) {
      cut = size;
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }

  if (rest) {
    chunks.push(rest);
  }

  return chunks;
}

function buildRichText(text) {
  return chunkText(text).map((content) => ({ type: 'text', text: { content } }));
}

// Monta o valor de uma propriedade conforme o tipo do Notion.
function buildPropertyValue(type, value) {
  switch (type) {
    case 'title':
      return { title: buildRichText(value) };
    case 'rich_text':
      return { rich_text: buildRichText(value) };
    case 'select':
      return value ? { select: { name: String(value) } } : { select: null };
    case 'multi_select':
      return {
        multi_select: (Array.isArray(value) ? value : [])
          .filter(Boolean)
          .map((name) => ({ name: String(name) })),
      };
    case 'checkbox':
      return { checkbox: Boolean(value) };
    case 'date':
      return value ? { date: { start: String(value) } } : { date: null };
    case 'number':
      return { number: value === '' || value == null ? null : Number(value) };
    default:
      return null;
  }
}

async function getProtocolPropertyTypes({ refresh = false } = {}) {
  if (cachedTypeMap && !refresh) {
    return cachedTypeMap;
  }

  const dataSource = await retrieveProtocolDataSource();
  const properties = dataSource?.properties || {};
  const map = {};

  for (const [name, def] of Object.entries(properties)) {
    map[name] = def?.type;
  }

  cachedTypeMap = map;
  return map;
}

/**
 * Constrói o objeto `properties` para o PATCH da página a partir de um protocolo.
 * `fields` (opcional) restringe quais campos escrever (usado na correção por diff).
 */
function buildProtocolProperties(protocol, typeMap, { fields } = {}) {
  const keys = fields || Object.keys(protocol);
  const properties = {};

  for (const key of keys) {
    const type = typeMap[key];

    if (!type || !WRITABLE_TYPES.has(type)) {
      continue; // campo inexistente na base ou tipo não gravável
    }

    if (!(key in protocol)) {
      continue;
    }

    const built = buildPropertyValue(type, protocol[key]);
    if (built) {
      properties[key] = built;
    }
  }

  return properties;
}

async function updateProtocolPage(pageId, properties) {
  if (!pageId) {
    const error = new Error('pageId é obrigatório para atualizar a página no Notion.');
    error.statusCode = 400;
    throw error;
  }

  return requestNotion(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Escreve um protocolo em uma página existente. `fields` limita os campos
 * (correção). Retorna a resposta do Notion.
 */
async function writeProtocolToPage(pageId, protocol, { fields } = {}) {
  const typeMap = await getProtocolPropertyTypes();
  const properties = buildProtocolProperties(protocol, typeMap, { fields });
  const response = await updateProtocolPage(pageId, properties);
  return { response, writtenFields: Object.keys(properties) };
}

function plainText(prop) {
  const arr = prop?.rich_text || prop?.title;
  return Array.isArray(arr) ? arr.map((x) => x?.plain_text || '').join('') : '';
}

// Lê o valor de uma propriedade do Notion para uma forma JS simples.
function readPropertyValue(prop) {
  if (!prop) {
    return '';
  }

  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return plainText(prop);
    case 'select':
      return prop.select?.name || '';
    case 'status':
      return prop.status?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((o) => o?.name).filter(Boolean);
    case 'checkbox':
      return Boolean(prop.checkbox);
    case 'date':
      return prop.date?.start || '';
    case 'number':
      return prop.number == null ? '' : prop.number;
    default:
      return '';
  }
}

// Lê todos os campos de uma página como { nome_propriedade: valor }.
function readPageFields(page) {
  const properties = page?.properties || {};
  const out = {};

  for (const [name, prop] of Object.entries(properties)) {
    out[name] = readPropertyValue(prop);
  }

  return out;
}

/**
 * Consulta páginas cujo status_automacao esteja em `values` (ex.: ['a gerar',
 * 'a corrigir']). Retorna a lista de páginas cruas do Notion.
 */
async function queryPagesByStatusAutomacao(values, { pageSize = 25 } = {}) {
  const { dataSourceId } = getNotionProtocolsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion protocols data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const filter = values.length === 1
    ? { property: 'status_automacao', select: { equals: values[0] } }
    : { or: values.map((value) => ({ property: 'status_automacao', select: { equals: value } })) };

  const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: JSON.stringify({ page_size: pageSize, filter }),
  });

  return Array.isArray(response.results) ? response.results : [];
}

module.exports = {
  NOTION_TEXT_LIMIT,
  chunkText,
  buildRichText,
  buildPropertyValue,
  buildProtocolProperties,
  getProtocolPropertyTypes,
  updateProtocolPage,
  writeProtocolToPage,
  readPropertyValue,
  readPageFields,
  queryPagesByStatusAutomacao,
};
