// Lê o schema da database de Manobras no Notion para extrair as opções vivas de
// "Category" (o único enum gerado pela IA). Reusa a config do sync das manobras.
// Espelha services/notionClinicalDrugSchema.js.

const { getConfig } = require('./notionPhysicalExamManeuversSync');
const { FIELD_TO_NOTION, resolveCategoryOptions } = require('../contracts/maneuverAutomation');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

function isNotionManeuversConfigured() {
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
    const error = new Error('Unable to read maneuvers schema from Notion.');
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

async function retrieveManeuverDataSource() {
  const { dataSourceId } = getConfig();

  if (!dataSourceId) {
    const error = new Error('Notion maneuvers data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  // O id configurado é de DATA SOURCE (o sync usa /data_sources/{id}/query).
  // Pedir por /databases/{id} devolve 404 e faria o enum cair no canônico —
  // o modelo perderia as opções vivas de Category.
  return requestNotion(`/data_sources/${dataSourceId}`, { method: 'GET' });
}

// Devolve { options: { category: [...] }, meta }. Campo ausente vira canônico.
async function getManeuverEnumOptions() {
  const dataSource = await retrieveManeuverDataSource();
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
  getManeuverEnumOptions,
  isNotionManeuversConfigured,
  requestNotion,
  retrieveManeuverDataSource,
};
