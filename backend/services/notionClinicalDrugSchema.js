// Lê o schema da database "Clínico Revisado" no Notion para extrair as opções
// vivas de "Risco Gestacional" (o único enum gerado pela IA). Reusa a config do
// sync do bulário (mesmo token/id e a API antiga /databases/{id}).

const { getNotionClinicalDrugsConfig } = require('./notionClinicalDrugsSync');
const { resolvePregnancyRiskOptions, FIELD_TO_NOTION } = require('../contracts/clinicalDrugAutomation');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';

function isNotionClinicalDrugsConfigured() {
  const { apiKey, dataSourceId } = getNotionClinicalDrugsConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionClinicalDrugsConfig();

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
    const error = new Error('Unable to read clinical drugs schema from Notion.');
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

async function retrieveClinicalDrugDataSource() {
  const { dataSourceId } = getNotionClinicalDrugsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion clinical drugs data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return requestNotion(`/databases/${dataSourceId}`, { method: 'GET' });
}

// Devolve { options: { pregnancy_risk: [...] }, meta }. Campos ausentes viram [].
async function getClinicalDrugEnumOptions() {
  const dataSource = await retrieveClinicalDrugDataSource();
  const properties = dataSource?.properties || {};
  const riskProperty = properties[FIELD_TO_NOTION.pregnancy_risk];
  const liveRiskOptions = riskProperty ? extractOptionNames(riskProperty) : [];

  return {
    options: {
      pregnancy_risk: resolvePregnancyRiskOptions(liveRiskOptions),
    },
    meta: {
      dataSourceId: getNotionClinicalDrugsConfig().dataSourceId,
      missingProperties: riskProperty ? [] : [FIELD_TO_NOTION.pregnancy_risk],
    },
  };
}

module.exports = {
  isNotionClinicalDrugsConfigured,
  requestNotion,
  retrieveClinicalDrugDataSource,
  getClinicalDrugEnumOptions,
  extractOptionNames,
};
