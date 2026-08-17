// Lê o schema da database "Ferramentas Clínicas" no Notion para extrair as
// opções vivas de Categoria e Subcategoria. Espelha notionExamSchema.js.

const { getNotionClinicalToolsConfig } = require('./notionClinicalToolsSync');
const { FIELD_TO_NOTION } = require('../contracts/clinicalToolAutomation');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

function isNotionClinicalToolsConfigured() {
  const { apiKey, dataSourceId } = getNotionClinicalToolsConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionClinicalToolsConfig();

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
    const error = new Error('Unable to read clinical tools schema from Notion.');
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

async function retrieveClinicalToolDataSource() {
  const { dataSourceId } = getNotionClinicalToolsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion clinical tools data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return requestNotion(`/data_sources/${dataSourceId}`, { method: 'GET' });
}

async function getClinicalToolEnumOptions() {
  const dataSource = await retrieveClinicalToolDataSource();
  const properties = dataSource?.properties || {};
  const categoryProperty = properties[FIELD_TO_NOTION.category];
  const subcategoryProperty = properties[FIELD_TO_NOTION.subcategory];
  const missingProperties = [
    categoryProperty ? null : FIELD_TO_NOTION.category,
    subcategoryProperty ? null : FIELD_TO_NOTION.subcategory,
  ].filter(Boolean);

  return {
    options: {
      category: categoryProperty ? extractOptionNames(categoryProperty) : [],
      subcategory: subcategoryProperty ? extractOptionNames(subcategoryProperty) : [],
    },
    meta: {
      dataSourceId: getNotionClinicalToolsConfig().dataSourceId,
      missingProperties,
    },
  };
}

module.exports = {
  extractOptionNames,
  getClinicalToolEnumOptions,
  isNotionClinicalToolsConfigured,
  requestNotion,
  retrieveClinicalToolDataSource,
};
