const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const DEFAULT_NOTION_VERSION = '2022-06-28';
const CLINICO_REVISADO_DATA_SOURCE_ID = '366da8a92980802a839ccbd8d2d7f111';
const MAX_SYNC_PAGES = 1000;

function normalizeNotionId(value) {
  return String(value || '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim();
}

function getNotionClinicalDrugsConfig() {
  return {
    apiKey: process.env.NOTION_CLINICO_REVISADO_TOKEN ||
      process.env.NOTION_TOKEN ||
      process.env.NOTION_API_KEY ||
      process.env.NOTION_ACCESS_TOKEN,
    dataSourceId: normalizeNotionId(
      process.env.NOTION_CLINICO_REVISADO_DATA_SOURCE_ID ||
        CLINICO_REVISADO_DATA_SOURCE_ID,
    ),
    notionVersion: process.env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isNotionClinicalDrugsSyncConfigured() {
  const { apiKey, dataSourceId, supabaseUrl, serviceRoleKey } = getNotionClinicalDrugsConfig();
  return Boolean(apiKey && dataSourceId && supabaseUrl && serviceRoleKey);
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

function normalizePublicationStatus(value) {
  const normalized = stripAccents(normalizeText(value)).toLowerCase();

  if (normalized === 'published' || normalized === 'publicado') {
    return 'published';
  }

  if (normalized === 'archived' || normalized === 'arquivado') {
    return 'archived';
  }

  return 'draft';
}

function normalizePregnancyRisk(value) {
  const normalized = normalizeText(value);
  const allowed = new Set(['A', 'B', 'C', 'D', 'X', 'Indefinido', 'Evitar']);

  return allowed.has(normalized) ? normalized : null;
}

function richTextToPlainText(items) {
  if (!Array.isArray(items)) {
    return '';
  }

  return items
    .map((item) => item?.plain_text || item?.text?.content || '')
    .join('')
    .trim();
}

function readProperty(properties, name) {
  return properties?.[name] || null;
}

function readTextProperty(properties, name) {
  const property = readProperty(properties, name);

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

  if (property.type === 'status') {
    return property.status?.name || '';
  }

  if (Array.isArray(property.multi_select)) {
    return property.multi_select.map((item) => item?.name).filter(Boolean).join('\n');
  }

  if (property.type === 'url') {
    return property.url || '';
  }

  if (property.type === 'number') {
    return property.number == null ? '' : String(property.number);
  }

  if (property.type === 'checkbox') {
    return property.checkbox ? 'true' : '';
  }

  if (property.type === 'date') {
    return property.date?.start || '';
  }

  if (Array.isArray(property.files)) {
    return property.files
      .map((file) => file?.external?.url || file?.file?.url || file?.name || '')
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function readDateProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.date?.start || null;
}

function buildSearchTerms(drug) {
  return [
    drug.active_ingredient,
    drug.class_category,
    drug.presentations,
    drug.commercial_names_anvisa,
    drug.commercial_names_openai,
    drug.anvisa_presentations,
    drug.anvisa_companies,
    drug.search_tags,
    drug.summary_text,
  ]
    .map(normalizeLongText)
    .filter(Boolean)
    .join('\n');
}

async function requestNotion(path, options = {}) {
  const { apiKey, notionVersion } = getNotionClinicalDrugsConfig();

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
    const error = new Error('Unable to read clinical drugs from Notion.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return response.json();
}

async function requestSupabase(table, path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getNotionClinicalDrugsConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Supabase service role is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${path}`, {
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
    const error = new Error('Unable to persist clinical drugs in Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function mapNotionPageToClinicalDrug(page) {
  const properties = page?.properties || {};
  const activeIngredient = normalizeText(readTextProperty(properties, 'Princípio Ativo'));
  const slug = normalizeSlug(readTextProperty(properties, 'Slug') || activeIngredient);
  const drug = {
    slug,
    notion_page_id: page?.id || null,
    active_ingredient: activeIngredient,
    class_category: normalizeText(readTextProperty(properties, 'Classe / Categoria')) || null,
    contraindications: normalizeLongText(readTextProperty(properties, 'Contraindicações')) || null,
    adult_dosage: normalizeLongText(readTextProperty(properties, 'Posologia Adulto')) || null,
    pediatric_dosage: normalizeLongText(readTextProperty(properties, 'Posologia Pediátrica')) || null,
    warnings: normalizeLongText(readTextProperty(properties, 'Advertências')) || null,
    interactions: normalizeLongText(readTextProperty(properties, 'Interações')) || null,
    presentations: normalizeLongText(readTextProperty(properties, 'Apresentações / nomes comerciais')) || null,
    commercial_names_anvisa: normalizeLongText(readTextProperty(properties, 'Nomes Comerciais / Produtos ANVISA')) || null,
    commercial_names_openai: normalizeLongText(readTextProperty(properties, 'Nomes Comerciais OpenAI')) || null,
    anvisa_presentations: normalizeLongText(readTextProperty(properties, 'Apresentações ANVISA')) || null,
    anvisa_companies: normalizeLongText(readTextProperty(properties, 'Empresas ANVISA')) || null,
    source_bula: normalizeLongText(readTextProperty(properties, 'Fonte Bula')) || null,
    pdf_file: normalizeLongText(readTextProperty(properties, 'Arquivo PDF')) || null,
    extraction_status: normalizeText(readTextProperty(properties, 'Status Extração')) || null,
    review_status: normalizeText(readTextProperty(properties, 'Status Revisão')) || null,
    publication_status: normalizePublicationStatus(readTextProperty(properties, 'Status Publicação')),
    pregnancy_risk: normalizePregnancyRisk(readTextProperty(properties, 'Risco Gestacional')),
    search_tags: normalizeLongText(readTextProperty(properties, 'Tags Busca')) || null,
    summary_text: normalizeLongText(readTextProperty(properties, 'Texto Resumo')) || null,
    extraction_date: readDateProperty(properties, 'Data Extração'),
    anvisa_enrichment_status: normalizeText(readTextProperty(properties, 'Status Enriquecimento ANVISA')) || null,
    openai_commercial_names_status: normalizeText(readTextProperty(properties, 'Status OpenAI Nomes Comerciais')) || null,
    openai_commercial_names_date: readDateProperty(properties, 'Data OpenAI Nomes Comerciais'),
    openai_commercial_names_sources: normalizeLongText(readTextProperty(properties, 'Fontes Nomes Comerciais OpenAI')) || null,
    source_updated_at: page?.last_edited_time || null,
    synced_at: new Date().toISOString(),
    sync_status: 'synced',
    sync_error: null,
  };

  drug.search_terms = buildSearchTerms(drug);

  const reasons = [];

  if (!drug.slug) {
    reasons.push('missing_slug');
  }

  if (!drug.active_ingredient) {
    reasons.push('missing_active_ingredient');
  }

  if (reasons.length > 0) {
    return {
      payload: null,
      error: {
        notionPageId: page?.id || null,
        activeIngredient: activeIngredient || null,
        slug: slug || null,
        reasons,
      },
    };
  }

  return {
    payload: drug,
    error: null,
  };
}

async function queryNotionClinicalDrugPages() {
  const { dataSourceId } = getNotionClinicalDrugsConfig();

  if (!dataSourceId) {
    const error = new Error('Notion clinical drugs data source is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const pages = [];
  let startCursor = null;

  do {
    const body = {
      page_size: 100,
      in_trash: false,
      result_type: 'page',
      sorts: [
        { property: 'Princípio Ativo', direction: 'ascending' },
      ],
      ...(startCursor ? { start_cursor: startCursor } : {}),
    };

    const response = await requestNotion(`/databases/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (Array.isArray(response.results)) {
      pages.push(...response.results);
    }

    startCursor = response.has_more && pages.length < MAX_SYNC_PAGES
      ? response.next_cursor
      : null;
  } while (startCursor);

  return pages;
}

async function upsertClinicalDrugs(drugs) {
  if (!Array.isArray(drugs) || drugs.length === 0) {
    return [];
  }

  const query = new URLSearchParams({
    on_conflict: 'slug',
  });

  const json = await requestSupabase('clinical_drugs', `?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(drugs),
  });

  return Array.isArray(json) ? json : [];
}

async function syncNotionClinicalDrugs() {
  const pages = await queryNotionClinicalDrugPages();
  const mapped = pages.map(mapNotionPageToClinicalDrug);
  const prepared = [];
  const skipped = [];

  mapped.forEach((drug) => {
    if (drug.error) {
      skipped.push(drug.error);
      return;
    }

    prepared.push(drug.payload);
  });

  const persisted = await upsertClinicalDrugs(prepared);

  return {
    totalFromNotion: pages.length,
    prepared: prepared.length,
    publishedAvailable: prepared.filter((drug) => drug.publication_status === 'published').length,
    persisted: persisted.length,
    skipped,
  };
}

module.exports = {
  getNotionClinicalDrugsConfig,
  isNotionClinicalDrugsSyncConfigured,
  mapNotionPageToClinicalDrug,
  queryNotionClinicalDrugPages,
  syncNotionClinicalDrugs,
};
