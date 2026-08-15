// Escrita no CMS de Manobras para a automação. Traduz as chaves do modelo
// (snake_case) para os rótulos das propriedades, monta o payload conforme o
// tipo real de cada propriedade e faz PATCH na página.
// Espelha services/notionClinicalDrugWriter.js e reusa os helpers puros de
// notionProtocolWriter.

const {
  buildPropertyValue,
  readPropertyValue,
} = require('./notionProtocolWriter');
const {
  requestNotion,
  retrieveManeuverDataSource,
} = require('./notionManeuverSchema');
const { getConfig } = require('./notionPhysicalExamManeuversSync');
const {
  FIELD_TO_NOTION,
  NOTION_TO_FIELD,
} = require('../contracts/maneuverAutomation');

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

async function getManeuverPropertyTypes({ refresh = false } = {}) {
  if (cachedTypeMap && !refresh) {
    return cachedTypeMap;
  }

  const dataSource = await retrieveManeuverDataSource();
  const properties = dataSource?.properties || {};
  const map = {};

  for (const [name, def] of Object.entries(properties)) {
    map[name] = def?.type;
  }

  cachedTypeMap = map;
  return map;
}

// Monta o objeto `properties` para o PATCH. `fields` (chaves snake_case) limita
// o que escrever (usado na correção por diff).
function buildManeuverProperties(maneuver, typeMap, { fields } = {}) {
  const keys = fields || Object.keys(maneuver);
  const properties = {};

  for (const key of keys) {
    const notionName = FIELD_TO_NOTION[key];

    if (!notionName || !(key in maneuver)) {
      continue;
    }

    const type = typeMap[notionName];

    if (!type || !WRITABLE_TYPES.has(type)) {
      continue; // propriedade inexistente ou tipo não gravável
    }

    const built = buildPropertyValue(type, maneuver[key]);

    if (built) {
      properties[notionName] = built;
    }
  }

  return properties;
}

async function updateManeuverPage(pageId, properties) {
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

async function writeManeuverToPage(pageId, maneuver, { fields } = {}) {
  const typeMap = await getManeuverPropertyTypes();
  const properties = buildManeuverProperties(maneuver, typeMap, { fields });
  const response = await updateManeuverPage(pageId, properties);
  return { response, writtenFields: Object.keys(properties) };
}

// Lê os campos de uma página traduzindo os rótulos do Notion para as chaves do
// modelo (snake_case). Propriedades desconhecidas são ignoradas.
function readManeuverPageFields(page) {
  const properties = page?.properties || {};
  const out = {};

  for (const [notionName, prop] of Object.entries(properties)) {
    const field = NOTION_TO_FIELD[notionName];

    if (field) {
      out[field] = readPropertyValue(prop);
    }
  }

  return out;
}

// Consulta páginas cujo "Status Automação" esteja em `values`.
async function queryManeuverPagesByStatus(values, { pageSize = 25 } = {}) {
  const { dataSourceId } = getConfig();

  if (!dataSourceId) {
    const error = new Error('Notion maneuvers data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const property = FIELD_TO_NOTION.automation_status;
  const filter = values.length === 1
    ? { property, select: { equals: values[0] } }
    : { or: values.map((value) => ({ property, select: { equals: value } })) };

  const response = await requestNotion(`/databases/${dataSourceId}/query`, {
    method: 'POST',
    body: JSON.stringify({ page_size: pageSize, filter }),
  });

  return Array.isArray(response.results) ? response.results : [];
}

module.exports = {
  buildManeuverProperties,
  getManeuverPropertyTypes,
  queryManeuverPagesByStatus,
  readManeuverPageFields,
  updateManeuverPage,
  writeManeuverToPage,
};
