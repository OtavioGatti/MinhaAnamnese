const { buildCustomEvaluation } = require('./userTemplates');

const MAX_SECTIONS = 40;
const MAX_LIST_ITEM_LENGTH = 180;
const OFFICIAL_TEMPLATE_SELECT = [
  'id',
  'slug',
  'notion_page_id',
  'name',
  'category',
  'description',
  'when_to_use',
  'base_example',
  'sections',
  'guide',
  'evaluation',
  'metadata',
  'status',
  'version',
  'display_order',
  'source_updated_at',
  'synced_at',
  'updated_at',
].join(',');

function getOfficialTemplatesAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isOfficialTemplatesStorageAvailable() {
  const { url, serviceRoleKey } = getOfficialTemplatesAdminConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function normalizeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeStatus(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized === 'published' || normalized === 'publicado') {
    return 'published';
  }

  if (normalized === 'archived' || normalized === 'arquivado') {
    return 'archived';
  }

  return 'draft';
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeList(value, options = {}) {
  const maxItems = options.maxItems || MAX_SECTIONS;
  const maxLength = options.maxLength || MAX_LIST_ITEM_LENGTH;
  const rawItems = Array.isArray(value)
    ? value
    : normalizeLongText(value)
        .split(/\n/g)
        .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''));

  const seen = new Set();
  const items = [];

  rawItems.forEach((item) => {
    const text = normalizeText(item).slice(0, maxLength);
    const key = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push(text);
  });

  return items.slice(0, maxItems);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasRuntimeEvaluation(value) {
  return isPlainObject(value) && Array.isArray(value.sections) && value.sections.length > 0;
}

function hasUsableTemplateShape(row) {
  return Boolean(row?.slug && row?.name && normalizeList(row.sections).length >= 2);
}

function mapOfficialTemplateRow(row) {
  if (!hasUsableTemplateShape(row)) {
    return null;
  }

  return {
    id: row.slug,
    nome: row.name,
    secoes: normalizeList(row.sections),
    source: 'official',
    description: row.description || '',
    category: row.category || '',
    whenToUse: row.when_to_use || '',
    baseExample: row.base_example || '',
    guide: normalizeList(row.guide, { maxItems: 60, maxLength: 240 }),
    version: normalizeNumber(row.version, 1),
    displayOrder: normalizeNumber(row.display_order, 1000),
    updated_at: row.updated_at || row.synced_at || null,
  };
}

function buildRuntimeOfficialTemplateConfig(row, fallbackTemplate = null) {
  const mapped = mapOfficialTemplateRow(row);

  if (!mapped) {
    return null;
  }

  return {
    nome: mapped.nome,
    secoes: mapped.secoes,
    promptVariant: fallbackTemplate?.promptVariant,
    sectionGuidance: fallbackTemplate?.sectionGuidance,
    evaluation: hasRuntimeEvaluation(row.evaluation)
      ? row.evaluation
      : fallbackTemplate?.evaluation || buildCustomEvaluation(mapped.secoes),
    description: mapped.description,
    category: mapped.category,
    whenToUse: mapped.whenToUse,
    baseExample: mapped.baseExample,
    guide: mapped.guide,
    source: 'official_sync',
    version: mapped.version,
  };
}

async function requestOfficialTemplates(path, options = {}) {
  const { url, serviceRoleKey } = getOfficialTemplatesAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Official templates storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/official_templates${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error('Unable to access official templates.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listSyncedOfficialTemplates() {
  if (!isOfficialTemplatesStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: OFFICIAL_TEMPLATE_SELECT,
    status: 'eq.published',
    order: 'display_order.asc,name.asc',
  });
  const json = await requestOfficialTemplates(`?${query.toString()}`, { method: 'GET' });

  return Array.isArray(json)
    ? json.map(mapOfficialTemplateRow).filter(Boolean)
    : [];
}

async function getSyncedOfficialTemplateConfig(slug, fallbackTemplate = null) {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug || !isOfficialTemplatesStorageAvailable()) {
    return null;
  }

  const query = new URLSearchParams({
    select: OFFICIAL_TEMPLATE_SELECT,
    slug: `eq.${normalizedSlug}`,
    status: 'eq.published',
    limit: '1',
  });
  const json = await requestOfficialTemplates(`?${query.toString()}`, { method: 'GET' });
  const row = Array.isArray(json) ? json[0] : null;

  return buildRuntimeOfficialTemplateConfig(row, fallbackTemplate);
}

function normalizeOfficialTemplatePayload(template) {
  const name = normalizeText(template?.name);
  const slug = normalizeSlug(template?.slug);
  const status = normalizeStatus(template?.status);
  const sections = normalizeList(template?.sections);
  const guide = normalizeList(template?.guide, { maxItems: 60, maxLength: 240 });
  const metadata = isPlainObject(template?.metadata) ? template.metadata : {};
  const evaluation = hasRuntimeEvaluation(template?.evaluation) ? template.evaluation : null;
  const syncError = [];

  if (!slug) {
    syncError.push('missing_slug');
  }

  if (!name) {
    syncError.push('missing_name');
  }

  if (status === 'published' && sections.length < 2) {
    syncError.push('published_template_requires_sections');
  }

  if (!slug || !name || (status === 'published' && sections.length < 2)) {
    return {
      payload: null,
      error: {
        slug: slug || null,
        name: name || null,
        reasons: syncError,
      },
    };
  }

  return {
    payload: {
      slug,
      notion_page_id: normalizeText(template?.notionPageId) || null,
      name,
      category: normalizeText(template?.category) || null,
      description: normalizeLongText(template?.description) || null,
      when_to_use: normalizeLongText(template?.whenToUse) || null,
      base_example: normalizeLongText(template?.baseExample) || null,
      sections,
      guide,
      evaluation,
      metadata,
      status,
      version: Math.max(1, normalizeNumber(template?.version, 1)),
      display_order: normalizeNumber(template?.displayOrder, 1000),
      source_updated_at: template?.sourceUpdatedAt || null,
      synced_at: new Date().toISOString(),
      sync_status: syncError.length > 0 ? 'skipped' : 'synced',
      sync_error: syncError.length > 0 ? syncError.join(',') : null,
    },
    error: null,
  };
}

async function upsertOfficialTemplates(templates) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const prepared = templates
    .map((template) => normalizeOfficialTemplatePayload(template).payload)
    .filter(Boolean);

  if (prepared.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'slug',
  });
  const json = await requestOfficialTemplates(`?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(prepared),
  });

  return Array.isArray(json) ? json.map(mapOfficialTemplateRow).filter(Boolean) : [];
}

module.exports = {
  buildRuntimeOfficialTemplateConfig,
  getSyncedOfficialTemplateConfig,
  isOfficialTemplatesStorageAvailable,
  listSyncedOfficialTemplates,
  normalizeList,
  normalizeOfficialTemplatePayload,
  normalizeSlug,
  normalizeStatus,
  upsertOfficialTemplates,
};
