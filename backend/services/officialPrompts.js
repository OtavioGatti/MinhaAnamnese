const OFFICIAL_PROMPT_SELECT = [
  'id',
  'slug',
  'notion_page_id',
  'name',
  'category',
  'category_key',
  'prompt_type',
  'model',
  'description',
  'when_to_use',
  'variables',
  'prompt_body',
  'source',
  'internal_notes',
  'status',
  'version',
  'display_order',
  'source_updated_at',
  'synced_at',
  'updated_at',
].join(',');
const DEFAULT_STRUCTURE_PROMPT_SLUG = 'structure_default_system';

function getOfficialPromptsAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isOfficialPromptsStorageAvailable() {
  const { url, serviceRoleKey } = getOfficialPromptsAdminConfig();
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
    .slice(0, 120);
}

const { normalizeCategoryKey } = require('../utils/categoryKeys');

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

function normalizePromptType(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized === 'system' || normalized === 'structure_system') {
    return 'structure_system';
  }

  return normalized || '';
}

function getPromptTypeAliases(value) {
  const normalizedPromptType = normalizePromptType(value);

  if (normalizedPromptType === 'structure_system') {
    return ['structure_system', 'system', 'System'];
  }

  return normalizedPromptType ? [normalizedPromptType] : [];
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeVariables(value) {
  const rawItems = Array.isArray(value)
    ? value
    : normalizeLongText(value).split(/[,;\n]/g);
  const seen = new Set();
  const items = [];

  rawItems.forEach((item) => {
    const text = normalizeText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push(text);
  });

  return items.slice(0, 80);
}

function hasUsablePromptShape(row) {
  return Boolean(row?.slug && row?.name && normalizeLongText(row.prompt_body));
}

function mapOfficialPromptRow(row) {
  if (!hasUsablePromptShape(row)) {
    return null;
  }

  return {
    slug: row.slug,
    name: row.name,
    category: row.category || '',
    categoryKey: row.category_key || '',
    promptType: normalizePromptType(row.prompt_type),
    model: row.model || '',
    description: row.description || '',
    whenToUse: row.when_to_use || '',
    variables: normalizeVariables(row.variables),
    promptBody: normalizeLongText(row.prompt_body),
    source: row.source || '',
    internalNotes: row.internal_notes || '',
    status: row.status || '',
    version: normalizeNumber(row.version, 1),
    displayOrder: normalizeNumber(row.display_order, 1000),
    updatedAt: row.updated_at || row.synced_at || null,
  };
}

async function requestOfficialPrompts(path, options = {}) {
  const { url, serviceRoleKey } = getOfficialPromptsAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Official prompts storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/official_prompts${path}`, {
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
    const error = new Error('Unable to access official prompts.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getSyncedOfficialPrompt(slug) {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug || !isOfficialPromptsStorageAvailable()) {
    return null;
  }

  const query = new URLSearchParams({
    select: OFFICIAL_PROMPT_SELECT,
    slug: `eq.${normalizedSlug}`,
    status: 'eq.published',
    limit: '1',
  });
  const json = await requestOfficialPrompts(`?${query.toString()}`, { method: 'GET' });
  const row = Array.isArray(json) ? json[0] : null;

  return mapOfficialPromptRow(row);
}

async function listPublishedOfficialPromptRows() {
  if (!isOfficialPromptsStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'slug,name,prompt_type,category_key,notion_page_id,source_updated_at,status',
    status: 'eq.published',
  });
  const json = await requestOfficialPrompts(`?${query.toString()}`, { method: 'GET' });
  return Array.isArray(json) ? json : [];
}

async function getPublishedPromptByCategoryAndType(categoryKey, promptType) {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  const promptTypeAliases = getPromptTypeAliases(promptType);

  if (!normalizedCategoryKey || !promptTypeAliases.length || !isOfficialPromptsStorageAvailable()) {
    return null;
  }

  const query = new URLSearchParams({
    select: OFFICIAL_PROMPT_SELECT,
    category_key: `eq.${normalizedCategoryKey}`,
    prompt_type: `in.(${promptTypeAliases.join(',')})`,
    status: 'eq.published',
    order: 'display_order.asc,name.asc',
    limit: '1',
  });
  const json = await requestOfficialPrompts(`?${query.toString()}`, { method: 'GET' });
  const row = Array.isArray(json) ? json[0] : null;

  return mapOfficialPromptRow(row);
}

async function getPublishedDefaultPromptByType(promptType) {
  if (normalizePromptType(promptType) === 'structure_system') {
    const prompt = await getSyncedOfficialPrompt(DEFAULT_STRUCTURE_PROMPT_SLUG);
    return prompt?.status === 'published' ? prompt : null;
  }

  return null;
}

function normalizeOfficialPromptPayload(prompt) {
  const name = normalizeText(prompt?.name);
  const slug = normalizeSlug(prompt?.slug);
  const status = normalizeStatus(prompt?.status);
  const promptBody = normalizeLongText(prompt?.promptBody);
  const syncError = [];

  if (!slug) {
    syncError.push('missing_slug');
  }

  if (!name) {
    syncError.push('missing_name');
  }

  if (!promptBody) {
    syncError.push('missing_prompt_body');
  }

  if (!slug || !name || !promptBody) {
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
      notion_page_id: normalizeText(prompt?.notionPageId) || null,
      name,
      category: normalizeText(prompt?.category) || null,
      category_key: normalizeCategoryKey(prompt?.categoryKey || prompt?.category) || null,
      prompt_type: normalizePromptType(prompt?.promptType) || null,
      model: normalizeText(prompt?.model) || null,
      description: normalizeLongText(prompt?.description) || null,
      when_to_use: normalizeLongText(prompt?.whenToUse) || null,
      variables: normalizeVariables(prompt?.variables),
      prompt_body: promptBody,
      source: normalizeLongText(prompt?.source) || null,
      internal_notes: normalizeLongText(prompt?.internalNotes) || null,
      status,
      version: Math.max(1, normalizeNumber(prompt?.version, 1)),
      display_order: normalizeNumber(prompt?.displayOrder, 1000),
      source_updated_at: prompt?.sourceUpdatedAt || null,
      synced_at: new Date().toISOString(),
      sync_status: syncError.length > 0 ? 'skipped' : 'synced',
      sync_error: syncError.length > 0 ? syncError.join(',') : null,
    },
    error: null,
  };
}

async function upsertOfficialPrompts(prompts) {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    return [];
  }

  const prepared = prompts
    .map((prompt) => normalizeOfficialPromptPayload(prompt).payload)
    .filter(Boolean);

  if (prepared.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'slug',
  });
  const json = await requestOfficialPrompts(`?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(prepared),
  });

  return Array.isArray(json) ? json.map(mapOfficialPromptRow).filter(Boolean) : [];
}

module.exports = {
  getPublishedDefaultPromptByType,
  getPublishedPromptByCategoryAndType,
  getSyncedOfficialPrompt,
  isOfficialPromptsStorageAvailable,
  listPublishedOfficialPromptRows,
  normalizeOfficialPromptPayload,
  normalizePromptType,
  normalizeSlug,
  normalizeStatus,
  normalizeVariables,
  upsertOfficialPrompts,
};
