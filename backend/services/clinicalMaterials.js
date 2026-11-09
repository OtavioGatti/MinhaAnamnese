// Catálogo da aba Materiais: leitura da tabela clinical_materials e entrega do
// PDF guardado no Storage (bucket privado "materiais").
//
// A lista é pequena (dezenas de itens), então a busca é feita em memória sobre o
// catálogo publicado inteiro — e sem acento dos dois lados, para "pressao" achar
// "pressão".

const { MATERIAL_TYPES, canAccessMaterial } = require('../config/materialsAccess');

const MATERIALS_BUCKET = 'materiais';
const MAX_QUERY_LENGTH = 80;
const MATERIAL_SELECT = [
  'slug',
  'title',
  'category',
  'description',
  'material_type',
  'credit',
  'external_url',
  'storage_path',
  'file_name',
  'file_size',
  'status',
  'display_order',
  'search_terms',
  'updated_at',
].join(',');

function getMaterialsConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isMaterialsStorageAvailable() {
  const { url, serviceRoleKey } = getMaterialsConfig();
  return Boolean(url && serviceRoleKey);
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeSearchText(value) {
  return stripAccents(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeMaterialSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeMaterialType(value) {
  const key = normalizeSearchText(value).replace(/[^a-z0-9]+/g, '_');
  const aliases = {
    material_proprio: 'proprio',
    proprio: 'proprio',
    escala_livre: 'escala_livre',
    link_oficial: 'link_oficial',
    link: 'link_oficial',
  };

  return aliases[key] || '';
}

function isSafeExternalUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:';
  } catch {
    return false;
  }
}

function getSearchTerms(query) {
  return normalizeSearchText(String(query || '').slice(0, MAX_QUERY_LENGTH))
    .split(' ')
    .filter((term) => term.length >= 2)
    .slice(0, 6);
}

function buildMaterialSearchTerms(material) {
  return normalizeSearchText([
    material.title,
    material.category,
    material.description,
    material.credit,
  ].filter(Boolean).join(' '));
}

function materialMatchesQuery(row, query) {
  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = row.search_terms || buildMaterialSearchTerms(row);
  return terms.every((term) => haystack.includes(term));
}

// O que a tela recebe. Item bloqueado aparece no catálogo (com cadeado), mas
// sem o link oficial: o endereço só sai para quem pode abrir.
function mapMaterialRow(row, { hasProAccess = false } = {}) {
  if (!row?.slug || !row?.title || !MATERIAL_TYPES.includes(row.material_type)) {
    return null;
  }

  const locked = !canAccessMaterial({ hasProAccess, materialType: row.material_type });
  const isLink = row.material_type === 'link_oficial';

  return {
    slug: row.slug,
    title: row.title,
    category: row.category || '',
    description: row.description || '',
    type: row.material_type,
    credit: row.credit || '',
    locked,
    hasFile: !isLink && Boolean(row.storage_path),
    fileSize: !isLink && Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
    externalUrl: isLink && !locked && isSafeExternalUrl(row.external_url) ? row.external_url : '',
    updatedAt: row.updated_at || null,
  };
}

async function requestMaterials(path, options = {}) {
  const { url, serviceRoleKey } = getMaterialsConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Materiais indisponíveis no momento.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/clinical_materials${path}`, {
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
    const error = new Error('Não foi possível acessar os materiais.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listPublishedMaterialRows() {
  const params = new URLSearchParams({
    select: MATERIAL_SELECT,
    status: 'eq.published',
    order: 'display_order.asc,title.asc',
    limit: '500',
  });
  const rows = await requestMaterials(`?${params.toString()}`, { method: 'GET' });

  return Array.isArray(rows) ? rows : [];
}

async function listMaterials({ query = '', category = '', hasProAccess = false } = {}) {
  const rows = await listPublishedMaterialRows();
  const wantedCategory = normalizeSearchText(category);

  return rows
    .filter((row) => !wantedCategory || normalizeSearchText(row.category) === wantedCategory)
    .filter((row) => materialMatchesQuery(row, query))
    .map((row) => mapMaterialRow(row, { hasProAccess }))
    .filter(Boolean);
}

async function getPublishedMaterialRow(slug) {
  const normalizedSlug = normalizeMaterialSlug(slug);

  if (!normalizedSlug) {
    return null;
  }

  const params = new URLSearchParams({
    select: MATERIAL_SELECT,
    status: 'eq.published',
    slug: `eq.${normalizedSlug}`,
    limit: '1',
  });
  const rows = await requestMaterials(`?${params.toString()}`, { method: 'GET' });

  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

function encodeStoragePath(storagePath) {
  return String(storagePath || '').split('/').map(encodeURIComponent).join('/');
}

async function downloadMaterialFile(storagePath) {
  const { url, serviceRoleKey } = getMaterialsConfig();

  if (!url || !serviceRoleKey || !storagePath) {
    const error = new Error('Arquivo indisponível no momento.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `${url}/storage/v1/object/${MATERIALS_BUCKET}/${encodeStoragePath(storagePath)}`,
    {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    const error = new Error('Arquivo não encontrado.');
    error.statusCode = response.status === 404 || response.status === 400 ? 404 : 503;
    throw error;
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = {
  MATERIALS_BUCKET,
  buildMaterialSearchTerms,
  downloadMaterialFile,
  getMaterialsConfig,
  getPublishedMaterialRow,
  isMaterialsStorageAvailable,
  isSafeExternalUrl,
  listMaterials,
  mapMaterialRow,
  materialMatchesQuery,
  normalizeMaterialSlug,
  normalizeMaterialType,
  normalizeSearchText,
};
