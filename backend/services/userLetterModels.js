const { isValidUserId } = require('../utils/idValidation');
const { MAX_FORMAT_BODY_LENGTH } = require('./officialLetterModels');
const { normalizeLetterTypeKey } = require('../config/letterTypes');

const MAX_TITLE_LENGTH = 80;
const MAX_MODELS_PER_USER = 60;

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isUserLetterModelsStorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function normalizeFormatBody(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_FORMAT_BODY_LENGTH);
}

function normalizeUserLetterModel(record) {
  if (!record || typeof record !== 'object' || !record.id) {
    return null;
  }

  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : '',
    letterType: normalizeLetterTypeKey(record.letter_type),
    formatBody: typeof record.format_body === 'string' ? record.format_body : '',
    isDefault: Boolean(record.is_default),
    displayOrder: Number(record.display_order) || 1000,
    source: 'custom',
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('user letter models storage unavailable');
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
    const error = new Error('user letter models request failed');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  return response;
}

async function listUserLetterModels(userId) {
  if (!isValidUserId(userId) || !isUserLetterModelsStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    order: 'letter_type.asc,display_order.asc,created_at.asc',
    limit: String(MAX_MODELS_PER_USER),
  });
  const response = await supabaseRequest(`user_letter_models?${query.toString()}`, { method: 'GET' });
  const json = await response.json();

  return Array.isArray(json) ? json.map(normalizeUserLetterModel).filter(Boolean) : [];
}

function validateInput({ title, formatBody }) {
  if (!normalizeTitle(title)) {
    return 'Dê um título ao modelo.';
  }

  if (!normalizeFormatBody(formatBody)) {
    return 'O formato do modelo não pode estar vazio.';
  }

  return null;
}

// Zera o padrão dos demais modelos do mesmo tipo antes de marcar um novo padrão
// (o índice único parcial exige no máximo um is_default por usuário+tipo).
async function clearDefaultForType(userId, letterType) {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    letter_type: `eq.${letterType}`,
    is_default: 'is.true',
  });

  await supabaseRequest(`user_letter_models?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_default: false }),
  });
}

async function createUserLetterModel(userId, { title, letterType, formatBody, isDefault = false }) {
  const validationError = validateInput({ title, formatBody });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const existing = await listUserLetterModels(userId);

  if (existing.length >= MAX_MODELS_PER_USER) {
    const error = new Error(`Limite de ${MAX_MODELS_PER_USER} modelos atingido. Apague algum para criar outro.`);
    error.statusCode = 400;
    throw error;
  }

  const normalizedType = normalizeLetterTypeKey(letterType);

  if (isDefault) {
    await clearDefaultForType(userId, normalizedType);
  }

  const response = await supabaseRequest('user_letter_models', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      title: normalizeTitle(title),
      letter_type: normalizedType,
      format_body: normalizeFormatBody(formatBody),
      is_default: Boolean(isDefault),
    }),
  });
  const json = await response.json();

  return normalizeUserLetterModel(Array.isArray(json) ? json[0] : null);
}

async function updateUserLetterModel(userId, modelId, { title, letterType, formatBody, isDefault = false }) {
  const validationError = validateInput({ title, formatBody });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const normalizedType = normalizeLetterTypeKey(letterType);

  if (isDefault) {
    await clearDefaultForType(userId, normalizedType);
  }

  const query = new URLSearchParams({
    id: `eq.${modelId}`,
    user_id: `eq.${userId}`,
  });
  const response = await supabaseRequest(`user_letter_models?${query.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title: normalizeTitle(title),
      letter_type: normalizedType,
      format_body: normalizeFormatBody(formatBody),
      is_default: Boolean(isDefault),
    }),
  });
  const json = await response.json();
  const updated = normalizeUserLetterModel(Array.isArray(json) ? json[0] : null);

  if (!updated) {
    const error = new Error('Modelo não encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return updated;
}

async function deleteUserLetterModel(userId, modelId) {
  const query = new URLSearchParams({
    id: `eq.${modelId}`,
    user_id: `eq.${userId}`,
  });

  await supabaseRequest(`user_letter_models?${query.toString()}`, { method: 'DELETE' });
  return true;
}

// Formato do modelo escolhido (por id) pertencente ao usuário, para injetar na
// geração. Retorna string vazia se não encontrado (cai no padrão do tipo).
async function getUserLetterModelFormat(userId, modelId) {
  if (!isValidUserId(userId) || !modelId || !isUserLetterModelsStorageAvailable()) {
    return '';
  }

  const query = new URLSearchParams({
    select: 'format_body',
    id: `eq.${modelId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await supabaseRequest(`user_letter_models?${query.toString()}`, { method: 'GET' });
  const json = await response.json();
  const row = Array.isArray(json) ? json[0] : null;

  return row?.format_body ? normalizeFormatBody(row.format_body) : '';
}

module.exports = {
  MAX_MODELS_PER_USER,
  createUserLetterModel,
  deleteUserLetterModel,
  getUserLetterModelFormat,
  isUserLetterModelsStorageAvailable,
  listUserLetterModels,
  normalizeUserLetterModel,
  updateUserLetterModel,
};
