// Escrita no CMS de Ferramentas Clínicas para a automação.
//
// Particularidade em relação aos outros writers: três campos da ferramenta
// (fields, engine_config, result_ranges) são objetos que vivem em colunas de
// TEXTO no Notion, serializados como JSON. É o mesmo formato que o sync lê de
// volta com parseJsonProperty, então a serialização aqui precisa ser JSON
// válido e indentado para continuar editável à mão por quem revisa.

const {
  buildPropertyValue,
  readPropertyValue,
} = require('./notionProtocolWriter');
const {
  requestNotion,
  retrieveClinicalToolDataSource,
} = require('./notionClinicalToolSchema');
const { getNotionClinicalToolsConfig } = require('./notionClinicalToolsSync');
const {
  FIELD_TO_NOTION,
  NOTION_TO_FIELD,
} = require('../contracts/clinicalToolAutomation');

const WRITABLE_TYPES = new Set([
  'title',
  'rich_text',
  'select',
  'multi_select',
  'checkbox',
  'date',
  'number',
]);

// Campos da ferramenta que viram JSON serializado numa coluna de texto.
const JSON_FIELD_SOURCES = {
  fields_json: 'fields',
  engine_config_json: 'engine_config',
  result_ranges_json: 'result_ranges',
};

let cachedTypeMap = null;

async function getClinicalToolPropertyTypes({ refresh = false } = {}) {
  if (cachedTypeMap && !refresh) {
    return cachedTypeMap;
  }

  const dataSource = await retrieveClinicalToolDataSource();
  const properties = dataSource?.properties || {};
  const map = {};

  for (const [name, def] of Object.entries(properties)) {
    map[name] = def?.type;
  }

  cachedTypeMap = map;
  return map;
}

// Achata a ferramenta gerada no formato de escrita: os três objetos viram
// strings JSON nas chaves *_json, o resto passa direto.
function buildWritableTool(tool = {}) {
  const writable = { ...tool };

  for (const [jsonField, sourceField] of Object.entries(JSON_FIELD_SOURCES)) {
    if (sourceField in tool) {
      writable[jsonField] = JSON.stringify(tool[sourceField], null, 2);
    }
  }

  return writable;
}

function buildClinicalToolProperties(tool, typeMap, { fields } = {}) {
  const writable = buildWritableTool(tool);
  const keys = fields || Object.keys(writable);
  const properties = {};

  for (const key of keys) {
    const notionName = FIELD_TO_NOTION[key];

    if (!notionName || !(key in writable)) {
      continue;
    }

    const type = typeMap[notionName];

    if (!type || !WRITABLE_TYPES.has(type)) {
      continue;
    }

    const built = buildPropertyValue(type, writable[key]);

    if (built) {
      properties[notionName] = built;
    }
  }

  return properties;
}

async function updateClinicalToolPage(pageId, properties) {
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

async function writeClinicalToolToPage(pageId, tool, { fields } = {}) {
  const typeMap = await getClinicalToolPropertyTypes();
  const properties = buildClinicalToolProperties(tool, typeMap, { fields });
  const response = await updateClinicalToolPage(pageId, properties);
  return { response, writtenFields: Object.keys(properties) };
}

function readClinicalToolPageFields(page) {
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

async function queryClinicalToolPagesByStatus(values, { pageSize = 25 } = {}) {
  const { dataSourceId } = getNotionClinicalToolsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion clinical tools data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const property = FIELD_TO_NOTION.automation_status;
  const filter = values.length === 1
    ? { property, select: { equals: values[0] } }
    : { or: values.map((value) => ({ property, select: { equals: value } })) };

  const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: JSON.stringify({ page_size: pageSize, result_type: 'page', filter }),
  });

  return Array.isArray(response.results) ? response.results : [];
}

module.exports = {
  buildClinicalToolProperties,
  buildWritableTool,
  getClinicalToolPropertyTypes,
  queryClinicalToolPagesByStatus,
  readClinicalToolPageFields,
  updateClinicalToolPage,
  writeClinicalToolToPage,
};
