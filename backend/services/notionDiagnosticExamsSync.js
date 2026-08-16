// Sync do CMS de exames complementares (Notion -> Supabase), mesmo padrão do
// catálogo de manobras.

const { shouldHoldFromSync } = require('../contracts/examAutomation');

const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2026-03-11';
// Data source "Minha Anamnese - Exames Complementares CMS".
const DEFAULT_EXAMS_DATA_SOURCE_ID = 'd0fb0557-8680-44d8-a2e4-2135b48449f8';
const MAX_SYNC_PAGES = 500;
const MAX_LONG_TEXT_LENGTH = 6000;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getConfig() {
  return {
    apiKey: process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_EXAMS_DATA_SOURCE_ID || DEFAULT_EXAMS_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isNotionExamsSyncConfigured() {
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
    const error = new Error('Unable to read diagnostic exams from Notion.');
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

  return items.map((item) => item?.plain_text || item?.text?.content || '').join('').trim();
}

function readTextProperty(properties, name) {
  const property = properties?.[name];

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

  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number);
  }

  return '';
}

function readNumberProperty(properties, name, fallback = null) {
  const property = properties?.[name];
  const rawValue = property?.number ?? readTextProperty(properties, name);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapNotionPageToExam(page) {
  const properties = page?.properties || {};

  return {
    notionPageId: page?.id || null,
    sourceUpdatedAt: page?.last_edited_time || null,
    name: readTextProperty(properties, 'Name'),
    slug: readTextProperty(properties, 'Slug'),
    aliases: readTextProperty(properties, 'Aliases'),
    category: readTextProperty(properties, 'Category'),
    relatedConditions: readTextProperty(properties, 'Related conditions'),
    whenToRequest: readTextProperty(properties, 'When to request'),
    preparation: readTextProperty(properties, 'Preparation'),
    howToInterpret: readTextProperty(properties, 'How to interpret'),
    limitations: readTextProperty(properties, 'Limitations'),
    source: readTextProperty(properties, 'Source'),
    reviewStatus: readTextProperty(properties, 'Review status'),
    status: readTextProperty(properties, 'Status'),
    displayOrder: readNumberProperty(properties, 'Order', 1000),
    internalNotes: readTextProperty(properties, 'Internal notes'),
    automationStatus: readTextProperty(properties, 'Status Automação'),
  };
}

function foldAccents(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_LONG_TEXT_LENGTH);
}

function normalizeSlug(value) {
  return foldAccents(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeStatus(value) {
  const normalized = foldAccents(value);

  if (normalized === 'published' || normalized === 'publicado') {
    return 'published';
  }

  if (normalized === 'archived' || normalized === 'arquivado') {
    return 'archived';
  }

  return 'draft';
}

function normalizeReviewStatus(value) {
  const normalized = foldAccents(value);

  if (normalized === 'validado') {
    return 'Validado';
  }

  if (normalized === 'nao usar sem validacao') {
    return 'Não usar sem validação';
  }

  return 'Revisão pendente';
}

function buildSearchText(model) {
  return foldAccents([
    model.name,
    model.aliases,
    model.category,
    model.relatedConditions,
  ].filter(Boolean).join(' '));
}

function normalizeExamPayload(model) {
  const name = normalizeText(model?.name);
  const slug = normalizeSlug(model?.slug || name);
  const reasons = [];

  if (!name) {
    reasons.push('missing_name');
  }

  if (!slug) {
    reasons.push('missing_slug');
  }

  if (reasons.length > 0) {
    return { payload: null, error: { slug: slug || null, name: name || null, reasons } };
  }

  return {
    payload: {
      slug,
      notion_page_id: normalizeText(model?.notionPageId) || null,
      name,
      aliases: normalizeText(model?.aliases) || null,
      category: normalizeText(model?.category) || null,
      related_conditions: normalizeText(model?.relatedConditions) || null,
      when_to_request: normalizeLongText(model?.whenToRequest) || null,
      preparation: normalizeLongText(model?.preparation) || null,
      how_to_interpret: normalizeLongText(model?.howToInterpret) || null,
      limitations: normalizeLongText(model?.limitations) || null,
      source: normalizeText(model?.source) || null,
      internal_notes: normalizeLongText(model?.internalNotes) || null,
      status: normalizeStatus(model?.status),
      review_status: normalizeReviewStatus(model?.reviewStatus),
      active: true,
      display_order: Number.isFinite(Number(model?.displayOrder)) ? Math.trunc(Number(model.displayOrder)) : 1000,
      search_text: buildSearchText({
        name,
        aliases: normalizeText(model?.aliases),
        category: normalizeText(model?.category),
        relatedConditions: normalizeText(model?.relatedConditions),
      }),
      source_updated_at: model?.sourceUpdatedAt || null,
      synced_at: new Date().toISOString(),
      sync_status: 'synced',
      sync_error: null,
    },
    error: null,
  };
}

async function queryNotionExamPages() {
  const { dataSourceId } = getConfig();

  if (!dataSourceId) {
    const error = new Error('Notion diagnostic exams data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const pages = [];
  let startCursor = null;

  do {
    const body = {
      page_size: 100,
      result_type: 'page',
      sorts: [{ property: 'Order', direction: 'ascending' }, { property: 'Name', direction: 'ascending' }],
      ...(startCursor ? { start_cursor: startCursor } : {}),
    };

    const response = await requestNotion(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (Array.isArray(response.results)) {
      pages.push(...response.results);
    }

    startCursor = response.has_more && pages.length < MAX_SYNC_PAGES ? response.next_cursor : null;
  } while (startCursor);

  return pages;
}

async function upsertExams(payloads) {
  const { supabaseUrl, serviceRoleKey } = getConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Supabase storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  if (payloads.length === 0) {
    return 0;
  }

  const query = new URLSearchParams({ on_conflict: 'slug' });
  const response = await fetch(`${supabaseUrl}/rest/v1/diagnostic_exams?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payloads),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Unable to store diagnostic exams.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return payloads.length;
}

// `bypassReviewGate` = sync manual (o humano clicou). No webhook automático fica
// false, e conteúdo recém-gerado pela IA é retido até alguém revisar.
async function syncNotionDiagnosticExams({ bypassReviewGate = false } = {}) {
  const pages = await queryNotionExamPages();
  const prepared = [];
  const skipped = [];
  const held = [];
  let publishedAvailable = 0;

  pages.map(mapNotionPageToExam).forEach((model) => {
    if (shouldHoldFromSync(model.automationStatus, { bypassReviewGate })) {
      held.push({ name: model.name || null, automationStatus: model.automationStatus });
      return;
    }

    const normalized = normalizeExamPayload(model);

    if (normalized.error) {
      skipped.push(normalized.error);
      return;
    }

    prepared.push(normalized.payload);

    if (normalized.payload.status === 'published') {
      publishedAvailable += 1;
    }
  });

  await upsertExams(prepared);

  return {
    totalFromNotion: pages.length,
    persisted: prepared.length,
    publishedAvailable,
    held,
    skipped,
  };
}

module.exports = {
  DEFAULT_EXAMS_DATA_SOURCE_ID,
  buildSearchText,
  getConfig,
  isNotionExamsSyncConfigured,
  mapNotionPageToExam,
  normalizeExamPayload,
  normalizeReviewStatus,
  normalizeSlug,
  normalizeStatus,
  queryNotionExamPages,
  syncNotionDiagnosticExams,
};
