const MAX_SEARCH_RESULTS = 60;
const MAX_QUERY_LENGTH = 80;

const GUIDE_SELECT = [
  'id',
  'slug',
  'title',
  'condition_name',
  'specialty',
  'subcondition',
  'contexts',
  'updated_at',
].join(',');

const ITEM_SELECT = [
  'id',
  'order_index',
  'item_type',
  'category',
  'title',
  'medication',
  'presentation',
  'dose',
  'route',
  'frequency',
  'duration',
  'dilution',
  'instructions',
  'care_notes',
  'warnings',
  'review_status',
  'copy_text',
].join(',');

function getPrescriptionGuidesConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isPrescriptionGuidesStorageAvailable() {
  const { url, serviceRoleKey } = getPrescriptionGuidesConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchQuery(value) {
  return normalizeText(value).slice(0, MAX_QUERY_LENGTH);
}

function sanitizePostgrestPattern(value) {
  return normalizeSearchQuery(value).replace(/[(),*]/g, ' ').trim();
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSearchTerms(value) {
  const raw = sanitizePostgrestPattern(value);
  const accentless = stripAccents(raw);
  const terms = [raw, accentless]
    .map((term) => normalizeText(term))
    .filter(Boolean);

  return Array.from(new Set(terms));
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return MAX_SEARCH_RESULTS;
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_RESULTS);
}

async function requestPrescriptionGuides(path, options = {}) {
  const { url, serviceRoleKey } = getPrescriptionGuidesConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Guias de prescrição indisponíveis.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error('Não foi possível acessar os guias de prescrição.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapGuideRow(row) {
  if (!row?.slug || !row?.condition_name) {
    return null;
  }

  return {
    slug: row.slug,
    title: row.title || row.condition_name,
    conditionName: row.condition_name,
    specialty: row.specialty || '',
    subcondition: row.subcondition || '',
    contexts: Array.isArray(row.contexts) ? row.contexts.filter(Boolean) : [],
    updatedAt: row.updated_at || null,
  };
}

function guideMatchesQuery(guide, query) {
  const normalizedQuery = stripAccents(query).toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = stripAccents([
    guide.title,
    guide.conditionName,
    guide.subcondition,
    guide.specialty,
    ...(guide.contexts || []),
  ].join(' ')).toLowerCase();

  if (haystack.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3);
  return queryTokens.length > 0 && queryTokens.every((token) => haystack.includes(token));
}

function mapItemRow(row) {
  if (!row?.id || !row?.copy_text) {
    return null;
  }

  return {
    id: row.id,
    orderIndex: Number(row.order_index) || 1000,
    itemType: row.item_type || 'Prescrição',
    category: row.category || 'Medicamento',
    title: row.title || row.copy_text,
    medication: row.medication || '',
    presentation: row.presentation || '',
    dose: row.dose || '',
    route: row.route || '',
    frequency: row.frequency || '',
    duration: row.duration || '',
    dilution: row.dilution || '',
    instructions: row.instructions || row.copy_text,
    careNotes: row.care_notes || '',
    warnings: row.warnings || '',
    reviewStatus: row.review_status || 'Revisão pendente',
    copyText: row.copy_text,
  };
}

function groupItemsByCategory(items) {
  const groupsByCategory = new Map();

  items.forEach((item) => {
    const category = item.category || 'Medicamento';
    if (!groupsByCategory.has(category)) {
      groupsByCategory.set(category, []);
    }

    groupsByCategory.get(category).push(item);
  });

  return Array.from(groupsByCategory.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
}

async function listPrescriptionGuides({ query = '', specialty = '', context = '', limit = MAX_SEARCH_RESULTS } = {}) {
  if (!isPrescriptionGuidesStorageAvailable()) {
    return [];
  }

  const searchTerms = getSearchTerms(query);
  const params = new URLSearchParams({
    select: GUIDE_SELECT,
    active: 'eq.true',
    status: 'eq.published',
    order: 'condition_name.asc',
    limit: String(normalizeLimit(limit)),
  });

  if (searchTerms.length > 0) {
    const orParts = searchTerms.flatMap((term) => [
      `condition_name.ilike.*${term}*`,
      `title.ilike.*${term}*`,
      `subcondition.ilike.*${term}*`,
      `specialty.ilike.*${term}*`,
    ]);
    params.set('or', `(${orParts.join(',')})`);
  }

  if (specialty) {
    params.set('specialty', `eq.${normalizeText(specialty)}`);
  }

  if (context) {
    params.set('contexts', `cs.{${normalizeText(context)}}`);
  }

  const json = await requestPrescriptionGuides(`prescription_guides?${params.toString()}`, { method: 'GET' });
  const directMatches = Array.isArray(json) ? json.map(mapGuideRow).filter(Boolean) : [];

  if (directMatches.length > 0 || searchTerms.length === 0) {
    return directMatches;
  }

  const fallbackParams = new URLSearchParams({
    select: GUIDE_SELECT,
    active: 'eq.true',
    status: 'eq.published',
    order: 'condition_name.asc',
    limit: '500',
  });

  if (specialty) {
    fallbackParams.set('specialty', `eq.${normalizeText(specialty)}`);
  }

  if (context) {
    fallbackParams.set('contexts', `cs.{${normalizeText(context)}}`);
  }

  const fallbackJson = await requestPrescriptionGuides(`prescription_guides?${fallbackParams.toString()}`, { method: 'GET' });
  const fallbackGuides = Array.isArray(fallbackJson)
    ? fallbackJson.map(mapGuideRow).filter(Boolean)
    : [];

  return fallbackGuides
    .filter((guide) => guideMatchesQuery(guide, query))
    .slice(0, normalizeLimit(limit));
}

async function getPrescriptionGuideBySlug(slug) {
  const normalizedSlug = normalizeText(slug);

  if (!normalizedSlug || !isPrescriptionGuidesStorageAvailable()) {
    return null;
  }

  const guideParams = new URLSearchParams({
    select: GUIDE_SELECT,
    slug: `eq.${normalizedSlug}`,
    active: 'eq.true',
    status: 'eq.published',
    limit: '1',
  });
  const guideRows = await requestPrescriptionGuides(`prescription_guides?${guideParams.toString()}`, { method: 'GET' });
  const guide = Array.isArray(guideRows) ? mapGuideRow(guideRows[0]) : null;

  if (!guide) {
    return null;
  }

  const itemParams = new URLSearchParams({
    select: ITEM_SELECT,
    guide_id: `eq.${guideRows[0].id}`,
    active: 'eq.true',
    review_status: 'neq.Não usar sem validação',
    order: 'order_index.asc,title.asc',
  });
  const itemRows = await requestPrescriptionGuides(`prescription_guide_items?${itemParams.toString()}`, { method: 'GET' });
  const items = Array.isArray(itemRows) ? itemRows.map(mapItemRow).filter(Boolean) : [];
  const copyText = items.map((item) => item.copyText).filter(Boolean).join('\n');

  return {
    ...guide,
    items,
    categories: groupItemsByCategory(items),
    copyText,
  };
}

module.exports = {
  getPrescriptionGuideBySlug,
  isPrescriptionGuidesStorageAvailable,
  listPrescriptionGuides,
};
