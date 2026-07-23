const {
  normalizeOfficialSnippetPayload,
  upsertOfficialSnippets,
} = require('./officialSnippets');
const { normalizeCategoryKey } = require('../utils/categoryKeys');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
// Data source "Minha Anamnese - Frases Prontas CMS" (criada em 13/07/2026).
const DEFAULT_SNIPPETS_DATA_SOURCE_ID = '2c5417eb-1ba2-4c6e-8d20-e5e00d0cc584';
const MAX_SYNC_PAGES = 500;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionSnippetsConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_SNIPPETS_DATA_SOURCE_ID ||
        process.env.NOTION_SNIPPETS_DATABASE_ID ||
        DEFAULT_SNIPPETS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
  };
}

function isNotionSnippetSyncConfigured() {
  const { apiKey, dataSourceId } = getNotionSnippetsConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionSnippetsConfig();

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
    const error = new Error('Unable to read snippets from Notion.');
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

function mapNotionPageToSnippet(page) {
  const properties = page?.properties || {};

  return {
    notionPageId: page?.id || null,
    sourceUpdatedAt: page?.last_edited_time || null,
    slug: readTextProperty(properties, 'Slug'),
    name: readTextProperty(properties, 'Name'),
    status: readSelectProperty(properties, 'Status'),
    category: readSelectProperty(properties, 'Category'),
    categoryKey: normalizeCategoryKey(readSelectProperty(properties, 'Category')),
    snippetType: readSelectProperty(properties, 'Snippet type'),
    displayOrder: readNumberProperty(properties, 'Order', 1000),
    body: readTextProperty(properties, 'Body'),
    internalNotes: readTextProperty(properties, 'Internal notes'),
  };
}

async function queryNotionSnippetPages() {
  const { dataSourceId } = getNotionSnippetsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion snippets data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const pages = [];
  let startCursor = null;

  do {
    const body = {
      page_size: 100,
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

async function syncNotionSnippets() {
  const pages = await queryNotionSnippetPages();
  const snippets = pages.map(mapNotionPageToSnippet);
  const prepared = [];
  const skipped = [];
  let publishedAvailable = 0;

  snippets.forEach((snippet) => {
    const normalized = normalizeOfficialSnippetPayload(snippet);

    if (normalized.error) {
      skipped.push(normalized.error);
      return;
    }

    prepared.push(snippet);

    if (normalized.payload.status === 'published') {
      publishedAvailable += 1;
    }
  });

  await upsertOfficialSnippets(prepared);

  return {
    totalFromNotion: pages.length,
    persisted: prepared.length,
    publishedAvailable,
    skipped,
  };
}

module.exports = {
  getNotionSnippetsConfig,
  isNotionSnippetSyncConfigured,
  mapNotionPageToSnippet,
  queryNotionSnippetPages,
  syncNotionSnippets,
};
