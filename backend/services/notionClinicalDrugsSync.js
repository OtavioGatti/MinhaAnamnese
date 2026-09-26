const { shouldHoldFromSync } = require('../contracts/clinicalDrugAutomation');

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

// Padrão: PUBLICADO, a menos que a página diga explicitamente "draft"/"rascunho"
// no Notion (ou "archived"/"arquivado"). Sem essa propriedade preenchida (caso
// mais comum hoje), o item é publicado — não fica escondido por padrão.
function normalizePublicationStatus(value) {
  const normalized = stripAccents(normalizeText(value)).toLowerCase();

  if (normalized === 'draft' || normalized === 'rascunho') {
    return 'draft';
  }

  if (normalized === 'archived' || normalized === 'arquivado') {
    return 'archived';
  }

  return 'published';
}

// O Notion usa opções compostas ("C; D no 3º trimestre", "B; evitar próximo ao
// termo"), mas a coluna do banco só aceita a letra. Antes, todo valor composto
// virava null e o medicamento aparecia sem gestação. Agora a letra inicial vai
// para `pregnancy_risk` e o texto completo para `monograph.pregnancyRiskLabel`.
function normalizePregnancyRisk(value) {
  const normalized = normalizeText(value);
  const allowed = new Set(['A', 'B', 'C', 'D', 'X', 'Indefinido', 'Evitar']);

  if (allowed.has(normalized)) {
    return normalized;
  }

  const leadingCategory = normalized.match(/^([ABCDX])(?=$|[\s;,.(])/);

  if (leadingCategory) {
    return leadingCategory[1];
  }

  if (/^indefinido/i.test(normalized)) {
    return 'Indefinido';
  }

  return null;
}

function splitMultiValue(value) {
  return normalizeLongText(value)
    .split('\n')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

// Seções da bula completa. Ficam num jsonb só (`monograph`): são exibidas, não
// filtradas, então não precisam de coluna própria nem de migração a cada campo.
const MONOGRAPH_TEXT_FIELDS = [
  ['indications', 'Indicações'],
  ['mechanism', 'Mecanismo de Ação'],
  ['administration', 'Administração'],
  ['adverseEffects', 'Efeitos Adversos'],
  ['renalAdjustment', 'Ajuste Renal'],
  ['hepaticAdjustment', 'Ajuste Hepático'],
  ['pregnancyUse', 'Uso na Gestação'],
  ['lactation', 'Lactação'],
  ['geriatricUse', 'Uso Geriátrico'],
  ['perioperative', 'Perioperatório'],
  ['monitoring', 'Monitoramento'],
  ['references', 'Referências'],
  ['reviewedBy', 'Revisado por'],
];

function buildMonograph(properties) {
  const monograph = {};

  MONOGRAPH_TEXT_FIELDS.forEach(([key, propertyName]) => {
    const value = normalizeLongText(readTextProperty(properties, propertyName));

    if (value) {
      monograph[key] = value;
    }
  });

  const pregnancyRiskLabel = normalizeText(readTextProperty(properties, 'Risco Gestacional'));
  const prescriptionType = normalizeText(readTextProperty(properties, 'Tipo de Receituário'));
  const clinicalReviewStatus = normalizeText(readTextProperty(properties, 'Status Revisão Clínica'));
  const reviewedAt = readDateProperty(properties, 'Data da Revisão');
  const pharmacologicClasses = splitMultiValue(readTextProperty(properties, 'Classes Farmacológicas'));

  if (pregnancyRiskLabel) monograph.pregnancyRiskLabel = pregnancyRiskLabel;
  if (prescriptionType) monograph.prescriptionType = prescriptionType;
  if (clinicalReviewStatus) monograph.clinicalReviewStatus = clinicalReviewStatus;
  if (reviewedAt) monograph.reviewedAt = reviewedAt;
  if (pharmacologicClasses.length > 0) monograph.pharmacologicClasses = pharmacologicClasses;
  if (readTextProperty(properties, 'Rede SUS (RENAME)') === 'true') monograph.susAvailable = true;

  return monograph;
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

function readFirstTextProperty(properties, names) {
  for (const name of names) {
    const value = readTextProperty(properties, name);

    if (value) {
      return value;
    }
  }

  return '';
}

function readDateProperty(properties, name) {
  const property = readProperty(properties, name);
  return property?.date?.start || null;
}

function parseJsonArrayProperty(properties, names) {
  const value = normalizeLongText(readFirstTextProperty(properties, names));

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
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

  // Status da automação de IA (o SYNC decide reter ou não, conforme a origem).
  const automationStatus = normalizeText(readTextProperty(properties, 'Status Automação'));
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
    interaction_pairs: parseJsonArrayProperty(properties, ['Interações Estruturadas']),
    presentations: normalizeLongText(readFirstTextProperty(properties, [
      'Apresentações / nomes comerciais',
      'Apresentações / Nomes Comerciais',
    ])) || null,
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
    monograph: buildMonograph(properties),
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
      automationStatus,
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
    automationStatus,
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

function isMissingMonographColumn(error) {
  const text = `${error?.message || ''} ${error?.responseBody || ''}`.toLowerCase();
  return text.includes('monograph') && (
    text.includes('column') || text.includes('schema cache') || text.includes('pgrst204')
  );
}

async function postClinicalDrugs(drugs) {
  const query = new URLSearchParams({
    on_conflict: 'notion_page_id',
  });

  const json = await requestSupabase('clinical_drugs', `?${query.toString()}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(drugs),
  });

  return Array.isArray(json) ? json : [];
}

// Enquanto supabase/clinical_drugs_monograph.sql não for aplicado à mão, a
// coluna não existe e o PostgREST recusaria o lote inteiro. Aí grava sem ela:
// o bulário continua sincronizando, só sem as seções novas.
async function upsertClinicalDrugs(drugs) {
  if (!Array.isArray(drugs) || drugs.length === 0) {
    return { persisted: 0, monographColumnMissing: false };
  }

  try {
    await postClinicalDrugs(drugs);
    return { persisted: drugs.length, monographColumnMissing: false };
  } catch (error) {
    if (!isMissingMonographColumn(error)) {
      throw error;
    }

    await postClinicalDrugs(drugs.map(({ monograph, ...rest }) => rest));
    return { persisted: drugs.length, monographColumnMissing: true };
  }
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function listExistingClinicalDrugsBySlugs(slugs) {
  const uniqueSlugs = [...new Set((slugs || []).filter(Boolean))];

  if (uniqueSlugs.length === 0) {
    return [];
  }

  const rows = [];
  for (const chunk of chunkArray(uniqueSlugs, 80)) {
    const query = new URLSearchParams({
      select: 'slug,active_ingredient,notion_page_id,source_updated_at',
      slug: `in.(${chunk.join(',')})`,
    });
    const json = await requestSupabase('clinical_drugs', `?${query.toString()}`, {
      method: 'GET',
    });
    if (Array.isArray(json)) {
      rows.push(...json);
    }
  }

  return rows;
}

async function syncNotionClinicalDrugs({ bypassReviewGate = false } = {}) {
  const pages = await queryNotionClinicalDrugPages();
  const mapped = pages.map(mapNotionPageToClinicalDrug);
  const prepared = [];
  const seenBySlug = new Map();
  const duplicateSlugs = [];
  const skipped = [];
  const heldForReview = [];

  mapped.forEach((drug) => {
    // Gate: retém páginas do fluxo de automação. No sync manual (bypass) o
    // conteúdo "aguardando revisão" é publicado; stubs/erros seguem retidos.
    if (shouldHoldFromSync(drug.automationStatus, { bypassReviewGate })) {
      heldForReview.push({
        notionPageId: drug.payload?.notion_page_id || drug.error?.notionPageId || null,
        activeIngredient: drug.payload?.active_ingredient || drug.error?.activeIngredient || null,
        slug: drug.payload?.slug || drug.error?.slug || null,
        automationStatus: drug.automationStatus,
      });
      return;
    }

    if (drug.error) {
      skipped.push(drug.error);
      return;
    }

    const slug = drug.payload.slug;
    if (seenBySlug.has(slug)) {
      const previous = seenBySlug.get(slug);
      duplicateSlugs.push({
        slug,
        first: {
          notionPageId: previous.notion_page_id,
          activeIngredient: previous.active_ingredient,
          sourceUpdatedAt: previous.source_updated_at,
        },
        duplicate: {
          notionPageId: drug.payload.notion_page_id,
          activeIngredient: drug.payload.active_ingredient,
          sourceUpdatedAt: drug.payload.source_updated_at,
        },
      });
      return;
    }

    seenBySlug.set(slug, drug.payload);
    prepared.push(drug.payload);
  });

  if (duplicateSlugs.length > 0) {
    const error = new Error('Duplicate clinical drug slugs found in Notion.');
    error.statusCode = 409;
    error.responseBody = JSON.stringify({
      code: 'duplicate_slug_in_notion_batch',
      message: 'Existem linhas duplicadas no Notion. Corrija manualmente antes de sincronizar com o Supabase.',
      totalDuplicates: duplicateSlugs.length,
      duplicates: duplicateSlugs,
    });
    throw error;
  }

  const existingRowsBySlug = await listExistingClinicalDrugsBySlugs(
    prepared.map((drug) => drug.slug),
  );
  const existingBySlug = new Map(existingRowsBySlug.map((row) => [row.slug, row]));
  const staleSlugConflicts = prepared
    .map((drug) => {
      const existing = existingBySlug.get(drug.slug);
      if (!existing || existing.notion_page_id === drug.notion_page_id) {
        return null;
      }

      return {
        slug: drug.slug,
        incoming: {
          notionPageId: drug.notion_page_id,
          activeIngredient: drug.active_ingredient,
          sourceUpdatedAt: drug.source_updated_at,
        },
        existing: {
          notionPageId: existing.notion_page_id,
          activeIngredient: existing.active_ingredient,
          sourceUpdatedAt: existing.source_updated_at,
        },
      };
    })
    .filter(Boolean);

  if (staleSlugConflicts.length > 0) {
    const error = new Error('Clinical drug slugs already exist in Supabase with different Notion page IDs.');
    error.statusCode = 409;
    error.responseBody = JSON.stringify({
      code: 'duplicate_slug_in_supabase',
      message: 'Existem slugs ja gravados no Supabase para outro page_id do Notion. Remova ou ajuste a linha antiga antes de sincronizar.',
      totalConflicts: staleSlugConflicts.length,
      conflicts: staleSlugConflicts,
    });
    throw error;
  }

  const { persisted, monographColumnMissing } = await upsertClinicalDrugs(prepared);

  return {
    totalFromNotion: pages.length,
    prepared: prepared.length,
    publishedAvailable: prepared.filter((drug) => drug.publication_status === 'published').length,
    persisted,
    ...(monographColumnMissing
      ? { warning: 'Coluna monograph ausente: aplique supabase/clinical_drugs_monograph.sql. Sincronizado sem as seções novas.' }
      : {}),
    heldForReview: heldForReview.length,
    heldItems: heldForReview,
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
