const MAX_SEARCH_RESULTS = 250;
const MAX_QUERY_LENGTH = 80;

const CLINICAL_DRUG_SELECT = [
  'id',
  'slug',
  'active_ingredient',
  'class_category',
  'contraindications',
  'adult_dosage',
  'pediatric_dosage',
  'warnings',
  'interactions',
  'presentations',
  'commercial_names_anvisa',
  'commercial_names_openai',
  'anvisa_presentations',
  'anvisa_companies',
  'source_bula',
  'pdf_file',
  'extraction_status',
  'review_status',
  'publication_status',
  'pregnancy_risk',
  'search_tags',
  'summary_text',
  'extraction_date',
  'updated_at',
].join(',');

function getClinicalDrugsConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isClinicalDrugsStorageAvailable() {
  const { url, serviceRoleKey } = getClinicalDrugsConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function parseLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit)) {
    return 30;
  }

  return Math.min(Math.max(limit, 1), MAX_SEARCH_RESULTS);
}

function getSearchTerms(query) {
  const normalized = normalizeText(query).slice(0, MAX_QUERY_LENGTH);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s+/)
    .map((term) => term.replace(/[%,()]/g, '').trim())
    .filter((term) => term.length >= 2)
    .slice(0, 6);
}

function isMissingClinicalDrugsTable(error) {
  const message = `${error?.message || ''} ${error?.responseBody || ''}`.toLowerCase();
  return (
    message.includes('clinical_drugs') &&
    (
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find')
    )
  );
}

async function requestClinicalDrugs(path, options = {}) {
  const { url, serviceRoleKey } = getClinicalDrugsConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Clinical drugs storage is unavailable.');
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
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Unable to access clinical drugs.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapClinicalDrugRow(row) {
  if (!row?.slug || !row?.active_ingredient) {
    return null;
  }

  return {
    id: row.id || row.slug,
    slug: row.slug,
    activeIngredient: row.active_ingredient,
    classCategory: row.class_category || '',
    contraindications: row.contraindications || '',
    adultDosage: row.adult_dosage || '',
    pediatricDosage: row.pediatric_dosage || '',
    warnings: row.warnings || '',
    interactions: row.interactions || '',
    presentations: row.presentations || '',
    commercialNamesAnvisa: row.commercial_names_anvisa || '',
    commercialNamesOpenai: row.commercial_names_openai || '',
    anvisaPresentations: row.anvisa_presentations || '',
    anvisaCompanies: row.anvisa_companies || '',
    sourceBula: row.source_bula || '',
    pdfFile: row.pdf_file || '',
    extractionStatus: row.extraction_status || '',
    reviewStatus: row.review_status || '',
    publicationStatus: row.publication_status || 'draft',
    pregnancyRisk: row.pregnancy_risk || '',
    searchTags: row.search_tags || '',
    summaryText: row.summary_text || '',
    extractionDate: row.extraction_date || null,
    updatedAt: row.updated_at || null,
  };
}

function buildClinicalDrugParams({ query = '', limit = 30 }) {
  const params = new URLSearchParams({
    select: CLINICAL_DRUG_SELECT,
    publication_status: 'eq.published',
    order: 'active_ingredient.asc',
    limit: String(parseLimit(limit)),
  });
  const terms = getSearchTerms(query);

  if (terms.length > 0) {
    const orParts = terms.flatMap((term) => [
      `active_ingredient.ilike.*${term}*`,
      `class_category.ilike.*${term}*`,
      `commercial_names_anvisa.ilike.*${term}*`,
      `commercial_names_openai.ilike.*${term}*`,
      `search_tags.ilike.*${term}*`,
      `search_terms.ilike.*${term}*`,
    ]);

    params.set('or', `(${orParts.join(',')})`);
  }

  return params;
}

function drugMatchesQuery(drug, query) {
  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = stripAccents([
    drug.activeIngredient,
    drug.classCategory,
    drug.commercialNamesAnvisa,
    drug.commercialNamesOpenai,
    drug.presentations,
    drug.searchTags,
    drug.summaryText,
  ].join(' ')).toLowerCase();

  return terms.every((term) => haystack.includes(stripAccents(term).toLowerCase()));
}

async function listClinicalDrugs({ query = '', limit = 30 } = {}) {
  if (!isClinicalDrugsStorageAvailable()) {
    return [];
  }

  const params = buildClinicalDrugParams({ query, limit });

  try {
    const json = await requestClinicalDrugs(`clinical_drugs?${params.toString()}`, { method: 'GET' });
    const drugs = Array.isArray(json) ? json.map(mapClinicalDrugRow).filter(Boolean) : [];

    return drugs.filter((drug) => drugMatchesQuery(drug, query)).slice(0, parseLimit(limit));
  } catch (error) {
    if (isMissingClinicalDrugsTable(error)) {
      return [];
    }

    throw error;
  }
}

async function getClinicalDrugBySlug(slug) {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug || !isClinicalDrugsStorageAvailable()) {
    return null;
  }

  const params = new URLSearchParams({
    select: CLINICAL_DRUG_SELECT,
    slug: `eq.${normalizedSlug}`,
    publication_status: 'eq.published',
    limit: '1',
  });

  try {
    const json = await requestClinicalDrugs(`clinical_drugs?${params.toString()}`, { method: 'GET' });
    const row = Array.isArray(json) ? json[0] : null;

    return mapClinicalDrugRow(row);
  } catch (error) {
    if (isMissingClinicalDrugsTable(error)) {
      return null;
    }

    throw error;
  }
}

function buildQuickSummary(drug) {
  if (!drug) {
    return '';
  }

  return normalizeLongText(drug.summaryText) ||
    [
      drug.classCategory ? `Classe: ${drug.classCategory}` : '',
      drug.adultDosage ? `Posologia adulto: ${drug.adultDosage}` : '',
      drug.contraindications ? `Contraindicacoes: ${drug.contraindications}` : '',
      drug.warnings ? `Advertencias: ${drug.warnings}` : '',
    ].filter(Boolean).join('\n');
}

module.exports = {
  buildQuickSummary,
  getClinicalDrugBySlug,
  isClinicalDrugsStorageAvailable,
  listClinicalDrugs,
  normalizeSlug,
};
