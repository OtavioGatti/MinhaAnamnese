const { normalizeCategoryKey } = require('../utils/categoryKeys');

const MAX_SNIPPET_BODY_LENGTH = 4000;
const OFFICIAL_SNIPPET_SELECT = [
  'id',
  'slug',
  'notion_page_id',
  'name',
  'category',
  'category_key',
  'snippet_type',
  'body',
  'status',
  'display_order',
  'source_updated_at',
  'synced_at',
  'updated_at',
].join(',');

function getOfficialSnippetsAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isOfficialSnippetsStorageAvailable() {
  const { url, serviceRoleKey } = getOfficialSnippetsAdminConfig();
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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeStatus(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function mapOfficialSnippetRow(row) {
  if (!row?.slug || !row?.name || !normalizeLongText(row.body)) {
    return null;
  }

  return {
    id: row.slug,
    slug: row.slug,
    title: row.name,
    category: row.category || '',
    categoryKey: row.category_key || '',
    snippetType: row.snippet_type || '',
    body: normalizeLongText(row.body),
    displayOrder: normalizeNumber(row.display_order, 1000),
    source: 'official',
    updatedAt: row.updated_at || row.synced_at || null,
  };
}

async function requestOfficialSnippets(path, options = {}) {
  const { url, serviceRoleKey } = getOfficialSnippetsAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Official snippets storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/official_snippets${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Unable to access official snippets.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listSyncedOfficialSnippets() {
  if (!isOfficialSnippetsStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: OFFICIAL_SNIPPET_SELECT,
    status: 'eq.published',
    order: 'display_order.asc,name.asc',
  });
  const json = await requestOfficialSnippets(`?${query.toString()}`, { method: 'GET' });

  return Array.isArray(json)
    ? json.map(mapOfficialSnippetRow).filter(Boolean)
    : [];
}

function normalizeOfficialSnippetPayload(snippet) {
  const name = normalizeText(snippet?.name);
  const slug = normalizeSlug(snippet?.slug);
  const status = normalizeStatus(snippet?.status);
  const body = normalizeLongText(snippet?.body).slice(0, MAX_SNIPPET_BODY_LENGTH);
  const syncError = [];

  if (!slug) {
    syncError.push('missing_slug');
  }

  if (!name) {
    syncError.push('missing_name');
  }

  if (!body) {
    syncError.push('missing_body');
  }

  if (syncError.length > 0) {
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
      notion_page_id: normalizeText(snippet?.notionPageId) || null,
      name,
      category: normalizeText(snippet?.category) || null,
      category_key: normalizeCategoryKey(snippet?.categoryKey || snippet?.category) || null,
      snippet_type: normalizeText(snippet?.snippetType) || null,
      body,
      internal_notes: normalizeLongText(snippet?.internalNotes) || null,
      status,
      display_order: normalizeNumber(snippet?.displayOrder, 1000),
      source_updated_at: snippet?.sourceUpdatedAt || null,
      synced_at: new Date().toISOString(),
      sync_status: 'synced',
      sync_error: null,
    },
    error: null,
  };
}

async function upsertOfficialSnippets(snippets) {
  if (!Array.isArray(snippets) || snippets.length === 0) {
    return [];
  }

  const prepared = snippets
    .map((snippet) => normalizeOfficialSnippetPayload(snippet).payload)
    .filter(Boolean);

  if (prepared.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'slug',
  });
  const json = await requestOfficialSnippets(`?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(prepared),
  });

  return Array.isArray(json) ? json.map(mapOfficialSnippetRow).filter(Boolean) : [];
}

module.exports = {
  MAX_SNIPPET_BODY_LENGTH,
  isOfficialSnippetsStorageAvailable,
  listSyncedOfficialSnippets,
  mapOfficialSnippetRow,
  normalizeOfficialSnippetPayload,
  normalizeSlug,
  normalizeStatus,
  upsertOfficialSnippets,
};
