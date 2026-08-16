// Escrita no CMS de Exames para a automação. Espelha
// services/notionManeuverWriter.js e reusa os helpers puros de
// notionProtocolWriter (buildPropertyValue/readPropertyValue/chunkText).

const {
  buildPropertyValue,
  readPropertyValue,
} = require('./notionProtocolWriter');
const {
  requestNotion,
  retrieveExamDataSource,
} = require('./notionExamSchema');
const { getConfig } = require('./notionDiagnosticExamsSync');
const {
  FIELD_TO_NOTION,
  NOTION_TO_FIELD,
} = require('../contracts/examAutomation');

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

async function getExamPropertyTypes({ refresh = false } = {}) {
  if (cachedTypeMap && !refresh) {
    return cachedTypeMap;
  }

  const dataSource = await retrieveExamDataSource();
  const properties = dataSource?.properties || {};
  const map = {};

  for (const [name, def] of Object.entries(properties)) {
    map[name] = def?.type;
  }

  cachedTypeMap = map;
  return map;
}

function buildExamProperties(exam, typeMap, { fields } = {}) {
  const keys = fields || Object.keys(exam);
  const properties = {};

  for (const key of keys) {
    const notionName = FIELD_TO_NOTION[key];

    if (!notionName || !(key in exam)) {
      continue;
    }

    const type = typeMap[notionName];

    if (!type || !WRITABLE_TYPES.has(type)) {
      continue;
    }

    const built = buildPropertyValue(type, exam[key]);

    if (built) {
      properties[notionName] = built;
    }
  }

  return properties;
}

async function updateExamPage(pageId, properties) {
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

async function writeExamToPage(pageId, exam, { fields } = {}) {
  const typeMap = await getExamPropertyTypes();
  const properties = buildExamProperties(exam, typeMap, { fields });
  const response = await updateExamPage(pageId, properties);
  return { response, writtenFields: Object.keys(properties) };
}

function readExamPageFields(page) {
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

async function queryExamPagesByStatus(values, { pageSize = 25 } = {}) {
  const { dataSourceId } = getConfig();

  if (!dataSourceId) {
    const error = new Error('Notion exams data source is not configured.');
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
  buildExamProperties,
  getExamPropertyTypes,
  queryExamPagesByStatus,
  readExamPageFields,
  updateExamPage,
  writeExamToPage,
};
