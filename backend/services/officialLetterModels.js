const { normalizeLetterTypeKey } = require('../config/letterTypes');

const MAX_FORMAT_BODY_LENGTH = 4000;
const OFFICIAL_LETTER_MODEL_SELECT = [
  'id',
  'slug',
  'notion_page_id',
  'name',
  'letter_type',
  'format_body',
  'status',
  'display_order',
  'source_updated_at',
  'synced_at',
  'updated_at',
].join(',');

// Mapa rótulo do Notion (ex.: "Contra-referência") -> key do registro.
const LETTER_TYPE_LABEL_TO_KEY = new Map([
  ['encaminhamento', 'encaminhamento'],
  ['contra-referencia', 'contrarreferencia'],
  ['contrarreferencia', 'contrarreferencia'],
  ['relatorio medico', 'relatorio'],
  ['relatorio', 'relatorio'],
  ['solicitacao/justificativa', 'solicitacao'],
  ['solicitacao', 'solicitacao'],
  ['declaracao de comparecimento', 'declaracao'],
  ['declaracao', 'declaracao'],
]);

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isOfficialLetterModelsStorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function foldAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeSlug(value) {
  return foldAccents(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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

// Converte o rótulo do Notion (ou qualquer valor) para a key canônica do tipo.
function resolveLetterTypeKey(value) {
  const folded = foldAccents(value);
  return LETTER_TYPE_LABEL_TO_KEY.get(folded) || normalizeLetterTypeKey(folded);
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function mapOfficialLetterModelRow(row) {
  if (!row?.slug || !row?.name || !normalizeLongText(row.format_body)) {
    return null;
  }

  return {
    id: row.slug,
    slug: row.slug,
    title: row.name,
    letterType: resolveLetterTypeKey(row.letter_type),
    formatBody: normalizeLongText(row.format_body),
    displayOrder: normalizeNumber(row.display_order, 1000),
    source: 'official',
    updatedAt: row.updated_at || row.synced_at || null,
  };
}

async function requestOfficialLetterModels(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Official letter models storage is unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/official_letter_models${path}`, {
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
    const error = new Error('Unable to access official letter models.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listSyncedOfficialLetterModels() {
  if (!isOfficialLetterModelsStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: OFFICIAL_LETTER_MODEL_SELECT,
    status: 'eq.published',
    order: 'display_order.asc,name.asc',
  });
  const json = await requestOfficialLetterModels(`?${query.toString()}`, { method: 'GET' });

  return Array.isArray(json)
    ? json.map(mapOfficialLetterModelRow).filter(Boolean)
    : [];
}

function normalizeOfficialLetterModelPayload(model) {
  const name = normalizeText(model?.name);
  const slug = normalizeSlug(model?.slug);
  const status = normalizeStatus(model?.status);
  const formatBody = normalizeLongText(model?.formatBody).slice(0, MAX_FORMAT_BODY_LENGTH);
  const reasons = [];

  if (!slug) {
    reasons.push('missing_slug');
  }

  if (!name) {
    reasons.push('missing_name');
  }

  if (!formatBody) {
    reasons.push('missing_format_body');
  }

  if (reasons.length > 0) {
    return {
      payload: null,
      error: { slug: slug || null, name: name || null, reasons },
    };
  }

  return {
    payload: {
      slug,
      notion_page_id: normalizeText(model?.notionPageId) || null,
      name,
      letter_type: resolveLetterTypeKey(model?.letterType),
      format_body: formatBody,
      internal_notes: normalizeLongText(model?.internalNotes) || null,
      status,
      display_order: normalizeNumber(model?.displayOrder, 1000),
      source_updated_at: model?.sourceUpdatedAt || null,
      synced_at: new Date().toISOString(),
      sync_status: 'synced',
      sync_error: null,
    },
    error: null,
  };
}

async function upsertOfficialLetterModels(models) {
  if (!Array.isArray(models) || models.length === 0) {
    return [];
  }

  const prepared = models
    .map((model) => normalizeOfficialLetterModelPayload(model).payload)
    .filter(Boolean);

  if (prepared.length === 0) {
    return [];
  }

  const query = new URLSearchParams({ on_conflict: 'slug' });
  const json = await requestOfficialLetterModels(`?${query.toString()}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(prepared),
  });

  return Array.isArray(json) ? json.map(mapOfficialLetterModelRow).filter(Boolean) : [];
}

module.exports = {
  MAX_FORMAT_BODY_LENGTH,
  isOfficialLetterModelsStorageAvailable,
  listSyncedOfficialLetterModels,
  mapOfficialLetterModelRow,
  normalizeOfficialLetterModelPayload,
  normalizeSlug,
  normalizeStatus,
  resolveLetterTypeKey,
  upsertOfficialLetterModels,
};
