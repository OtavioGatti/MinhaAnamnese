const { isValidUserId } = require('../utils/idValidation');
const { MAX_SNIPPET_BODY_LENGTH } = require('./officialSnippets');

const MAX_TITLE_LENGTH = 80;
const MAX_SNIPPETS_PER_USER = 50;

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isUserSnippetsStorageAvailable() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function normalizeBody(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_SNIPPET_BODY_LENGTH);
}

function normalizeSnippetType(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
}

function normalizeUserSnippet(record) {
  if (!record || typeof record !== 'object' || !record.id) {
    return null;
  }

  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    snippetType: typeof record.snippet_type === 'string' ? record.snippet_type : null,
    displayOrder: Number(record.display_order) || 1000,
    source: 'custom',
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('user snippets storage unavailable');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error('user snippets request failed');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  return response;
}

async function listUserSnippets(userId) {
  if (!isValidUserId(userId) || !isUserSnippetsStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    order: 'display_order.asc,created_at.asc',
    limit: String(MAX_SNIPPETS_PER_USER),
  });
  const response = await supabaseRequest(`user_snippets?${query.toString()}`, { method: 'GET' });
  const json = await response.json();

  return Array.isArray(json) ? json.map(normalizeUserSnippet).filter(Boolean) : [];
}

function validateSnippetInput({ title, body }) {
  if (!normalizeTitle(title)) {
    return 'Dê um título ao modelo.';
  }

  if (!normalizeBody(body)) {
    return 'O texto do modelo não pode estar vazio.';
  }

  return null;
}

async function createUserSnippet(userId, { title, body, snippetType }) {
  const validationError = validateSnippetInput({ title, body });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const existing = await listUserSnippets(userId);

  if (existing.length >= MAX_SNIPPETS_PER_USER) {
    const error = new Error(`Limite de ${MAX_SNIPPETS_PER_USER} modelos atingido. Apague algum para criar outro.`);
    error.statusCode = 400;
    throw error;
  }

  const response = await supabaseRequest('user_snippets', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      title: normalizeTitle(title),
      body: normalizeBody(body),
      snippet_type: normalizeSnippetType(snippetType),
    }),
  });
  const json = await response.json();

  return normalizeUserSnippet(Array.isArray(json) ? json[0] : null);
}

async function updateUserSnippet(userId, snippetId, { title, body, snippetType }) {
  const validationError = validateSnippetInput({ title, body });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const query = new URLSearchParams({
    id: `eq.${snippetId}`,
    user_id: `eq.${userId}`,
  });
  const response = await supabaseRequest(`user_snippets?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      title: normalizeTitle(title),
      body: normalizeBody(body),
      snippet_type: normalizeSnippetType(snippetType),
    }),
  });
  const json = await response.json();
  const updated = normalizeUserSnippet(Array.isArray(json) ? json[0] : null);

  if (!updated) {
    const error = new Error('Modelo não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return updated;
}

async function deleteUserSnippet(userId, snippetId) {
  const query = new URLSearchParams({
    id: `eq.${snippetId}`,
    user_id: `eq.${userId}`,
  });

  await supabaseRequest(`user_snippets?${query.toString()}`, { method: 'DELETE' });
  return true;
}

module.exports = {
  MAX_SNIPPETS_PER_USER,
  createUserSnippet,
  deleteUserSnippet,
  isUserSnippetsStorageAvailable,
  listUserSnippets,
  normalizeUserSnippet,
  updateUserSnippet,
};
