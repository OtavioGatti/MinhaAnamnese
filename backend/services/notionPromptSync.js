const {
  normalizeOfficialPromptPayload,
  normalizeVariables,
  upsertOfficialPrompts,
} = require('./officialPrompts');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const DEFAULT_PROMPTS_DATA_SOURCE_ID = 'd5c8b3fc-5b20-4aac-bb3e-e9b46b14fe90';
const MAX_SYNC_PAGES = 500;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionPromptsConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_PROMPTS_DATA_SOURCE_ID ||
        process.env.NOTION_PROMPTS_DATABASE_ID ||
        DEFAULT_PROMPTS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
  };
}

function isNotionPromptSyncConfigured() {
  const { apiKey, dataSourceId } = getNotionPromptsConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionPromptsConfig();

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
    const error = new Error('Unable to read prompts from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

function richTextToPlainText(items) {
  if (!Array.isArray(items)) {
    return '';
  }

  return items
    .map((item) => item?.plain_text || item?.text?.content || '')
    .join('')
    .trim();
}

function readProperty(properties, name) {
  return properties?.[name] || null;
}

function readTextProperty(properties, name) {
  const property = readProperty(properties, name);

  if (!property) {
    return '';
  }

  if (Array.isArray(property.title)) {
    return richTextToPlainText(property.title);
  }

  if (Array.isArray(property.rich_text)) {
    return richTextToPlainText(property.rich_text);
  }

  if (property.type === 'select') {
    return property.select?.name || '';
  }

  if (property.type === 'status') {
    return property.status?.name || '';
  }

  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number);
  }

  return '';
}

function readSelectProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.select?.name || property?.status?.name || readTextProperty(properties, name);
}

function readNumberProperty(properties, name, fallback = null) {
  const property = readProperty(properties, name);
  const rawValue = property?.number ?? readTextProperty(properties, name);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapNotionPageToPrompt(page) {
  const properties = page?.properties || {};

  return {
    notionPageId: page?.id || null,
    sourceUpdatedAt: page?.last_edited_time || null,
    slug: readTextProperty(properties, 'Slug'),
    name: readTextProperty(properties, 'Name'),
    status: readSelectProperty(properties, 'Status'),
    category: readSelectProperty(properties, 'Category'),
    promptType: readSelectProperty(properties, 'Prompt type'),
    model: readSelectProperty(properties, 'Model'),
    version: readNumberProperty(properties, 'Version', 1),
    displayOrder: readNumberProperty(properties, 'Order', 1000),
    description: readTextProperty(properties, 'Description'),
    whenToUse: readTextProperty(properties, 'When to use'),
    variables: normalizeVariables(readTextProperty(properties, 'Variables')),
    promptBody: readTextProperty(properties, 'Prompt body'),
    source: readTextProperty(properties, 'Source'),
    internalNotes: readTextProperty(properties, 'Internal notes'),
  };
}

async function queryNotionPromptPages() {
  const { dataSourceId } = getNotionPromptsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion prompts data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const pages = [];
  let startCursor = null;

  do {
    const body = {
      page_size: 100,
      in_trash: false,
      result_type: 'page',
      sorts: [
        { property: 'Order', direction: 'ascending' },
        { property: 'Name', direction: 'ascending' },
      ],
      ...(startCursor ? { start_cursor: startCursor } : {}),
    };

    const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (Array.isArray(response.results)) {
      pages.push(...response.results);
    }

    startCursor = response.has_more && pages.length < MAX_SYNC_PAGES
      ? response.next_cursor
      : null;
  } while (startCursor);

  return pages;
}

async function syncNotionPrompts() {
  const pages = await queryNotionPromptPages();
  const prompts = pages.map(mapNotionPageToPrompt);
  const prepared = [];
  const skipped = [];
  let publishedAvailable = 0;

  prompts.forEach((prompt) => {
    const normalized = normalizeOfficialPromptPayload(prompt);

    if (normalized.error) {
      skipped.push(normalized.error);
      return;
    }

    prepared.push(prompt);

    if (normalized.payload.status === 'published') {
      publishedAvailable += 1;
    }
  });

  await upsertOfficialPrompts(prepared);

  return {
    totalFromNotion: pages.length,
    persisted: prepared.length,
    publishedAvailable,
    skipped,
  };
}

module.exports = {
  getNotionPromptsConfig,
  isNotionPromptSyncConfigured,
  mapNotionPageToPrompt,
  queryNotionPromptPages,
  syncNotionPrompts,
};
