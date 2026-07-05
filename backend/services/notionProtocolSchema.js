// Lê o SCHEMA da database "Protocolos de Prescrição - CMS" no Notion para
// extrair as opções vivas de select/multi_select. Os enums do JSON Schema de
// geração são montados a partir daqui — nunca hardcodados.
//
// Reusa a mesma data source e variáveis de ambiente de notionPrescriptionGuideSync.js.

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const DEFAULT_PROTOCOLS_DATA_SOURCE_ID = '1ea5a7f5-5c0f-4df8-b8aa-872788b513d0';

// Campo do contrato -> nome da propriedade no Notion.
const ENUM_PROPERTY_NAMES = {
  especialidade: 'especialidade',
  contexto: 'contexto',
  tipo_protocolo: 'tipo_protocolo',
  nivel_risco: 'nivel_risco',
};

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionProtocolsConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_PRESCRIPTIONS_DATA_SOURCE_ID ||
        process.env.NOTION_PRESCRIPTION_GUIDES_DATA_SOURCE_ID ||
        process.env.NOTION_PROTOCOLS_DATA_SOURCE_ID ||
        process.env.NOTION_PRESCRIPTIONS_DATABASE_ID ||
        process.env.NOTION_PROTOCOLS_DATABASE_ID ||
        DEFAULT_PROTOCOLS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
  };
}

function isNotionProtocolsConfigured() {
  const { apiKey, dataSourceId } = getNotionProtocolsConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionProtocolsConfig();

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
    const error = new Error('Unable to read protocols schema from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

// Extrai os nomes de opção de uma propriedade, seja ela select, multi_select ou status.
function extractOptionNames(property) {
  const container = property?.multi_select || property?.select || property?.status;
  const options = Array.isArray(container?.options) ? container.options : [];
  return options.map((option) => option?.name).filter(Boolean);
}

async function retrieveProtocolDataSource() {
  const { dataSourceId } = getNotionProtocolsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion protocols data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  return requestNotion(`/data_sources/${dataSourceId}`, { method: 'GET' });
}

/**
 * Devolve as opções vivas dos campos restritos:
 * { especialidade, contexto, tipo_protocolo, nivel_risco }
 * Cada valor é um array de nomes de opção. Campos ausentes viram [].
 */
async function getProtocolEnumOptions() {
  const dataSource = await retrieveProtocolDataSource();
  const properties = dataSource?.properties || {};
  const options = {};
  const missing = [];

  for (const [field, notionName] of Object.entries(ENUM_PROPERTY_NAMES)) {
    const property = properties[notionName];

    if (!property) {
      options[field] = [];
      missing.push(notionName);
      continue;
    }

    options[field] = extractOptionNames(property);
  }

  return {
    options,
    meta: {
      dataSourceId: getNotionProtocolsConfig().dataSourceId,
      title: Array.isArray(dataSource?.title)
        ? dataSource.title.map((item) => item?.plain_text || '').join('').trim()
        : '',
      missingProperties: missing,
    },
  };
}

module.exports = {
  getNotionProtocolsConfig,
  isNotionProtocolsConfigured,
  retrieveProtocolDataSource,
  getProtocolEnumOptions,
  extractOptionNames,
  ENUM_PROPERTY_NAMES,
};
