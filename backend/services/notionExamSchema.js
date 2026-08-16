// Lê o schema da database de Exames no Notion para extrair as opções vivas de
// "Category". Espelha services/notionManeuverSchema.js.

const { getConfig } = require('./notionDiagnosticExamsSync');
const { FIELD_TO_NOTION, resolveCategoryOptions } = require('../contracts/examAutomation');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

function isNotionExamsConfigured() {
  const { apiKey, dataSourceId } = getConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getConfig();

  if (!apiKey) {
    const error = new Error('Notion API key is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': notionVersion,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Unable to read exams schema from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

function extractOptionNames(property) {
  const container = property?.multi_select || property?.select || property?.status;
  const options = Array.isArray(container?.options) ? container.options : [];
  return options.map((option) => option?.name).filter(Boolean);
}

async function retrieveExamDataSource() {
  const { dataSourceId } = getConfig();

  if (!dataSourceId) {
    const error = new Error('Notion exams data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  // Data source, não database: o id configurado é o mesmo do sync.
  return requestNotion(`/data_sources/${dataSourceId}`, { method: 'GET' });
}

async function getExamEnumOptions() {
  const dataSource = await retrieveExamDataSource();
  const properties = dataSource?.properties || {};
  const categoryProperty = properties[FIELD_TO_NOTION.category];
  const liveCategoryOptions = categoryProperty ? extractOptionNames(categoryProperty) : [];

  return {
    options: {
      category: resolveCategoryOptions(liveCategoryOptions),
    },
    meta: {
      dataSourceId: getConfig().dataSourceId,
      missingProperties: categoryProperty ? [] : [FIELD_TO_NOTION.category],
    },
  };
}

module.exports = {
  extractOptionNames,
  getExamEnumOptions,
  isNotionExamsConfigured,
  requestNotion,
  retrieveExamDataSource,
};
