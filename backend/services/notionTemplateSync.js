const {
  normalizeList,
  normalizeOfficialTemplatePayload,
  upsertOfficialTemplates,
} = require('./officialTemplates');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const MAX_SYNC_PAGES = 500;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionTemplatesConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_TEMPLATES_DATA_SOURCE_ID ||
        process.env.NOTION_TEMPLATES_DATABASE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
  };
}

function isNotionTemplateSyncConfigured() {
  const { apiKey, dataSourceId } = getNotionTemplatesConfig();
  return Boolean(apiKey && dataSourceId);
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionTemplatesConfig();

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
    const error = new Error('Unable to read templates from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
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

  if (Array.isArray(property.text)) {
    return richTextToPlainText(property.text);
  }

  if (typeof property.text === 'string') {
    return property.text.trim();
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

function readDateProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.date?.start || null;
}

function parseOptionalEvaluation(value) {
  const text = String(value || '').trim();

  if (!text || !text.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && Array.isArray(parsed.sections) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function mapNotionPageToTemplate(page) {
  const properties = page?.properties || {};
  const scoringHints = readTextProperty(properties, 'Scoring hints');
  const internalNotes = readTextProperty(properties, 'Internal notes');

  return {
    notionPageId: page?.id || null,
    sourceUpdatedAt: page?.last_edited_time || null,
    slug: readTextProperty(properties, 'Slug'),
    name: readTextProperty(properties, 'Name'),
    status: readSelectProperty(properties, 'Status'),
    category: readSelectProperty(properties, 'Category'),
    displayOrder: readNumberProperty(properties, 'Order', 1000),
    version: readNumberProperty(properties, 'Version', 1),
    description: readTextProperty(properties, 'Description'),
    whenToUse: readTextProperty(properties, 'When to use'),
    baseExample: readTextProperty(properties, 'Base example'),
    sections: normalizeList(readTextProperty(properties, 'Sections')),
    guide: normalizeList(readTextProperty(properties, 'Clinical guide'), {
      maxItems: 60,
      maxLength: 240,
    }),
    evaluation: parseOptionalEvaluation(scoringHints),
    metadata: {
      notionUrl: page?.url || null,
      lastReviewed: readDateProperty(properties, 'Last reviewed'),
      scoringHints: normalizeList(scoringHints, { maxItems: 80, maxLength: 240 }),
      internalNotes: internalNotes || null,
    },
  };
}

async function queryNotionTemplatePages() {
  const { dataSourceId } = getNotionTemplatesConfig();

  if (!dataSourceId) {
    const error = new Error('Notion templates data source is not configured.');
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

async function syncNotionTemplates() {
  const pages = await queryNotionTemplatePages();
  const templates = pages.map(mapNotionPageToTemplate);
  const prepared = [];
  const skipped = [];

  templates.forEach((template) => {
    const normalized = normalizeOfficialTemplatePayload(template);

    if (normalized.error) {
      skipped.push(normalized.error);
      return;
    }

    prepared.push(template);
  });

  const upsertedPublishedTemplates = await upsertOfficialTemplates(prepared);

  return {
    totalFromNotion: pages.length,
    persisted: prepared.length,
    publishedAvailable: upsertedPublishedTemplates.length,
    skipped,
  };
}

module.exports = {
  getNotionTemplatesConfig,
  isNotionTemplateSyncConfigured,
  mapNotionPageToTemplate,
  queryNotionTemplatePages,
  syncNotionTemplates,
};
