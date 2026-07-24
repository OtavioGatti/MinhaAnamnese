// Enfileira bulas incompletas para o modo auto-completar: varre o Supabase por
// medicamentos publicados com campos de conteúdo vazios e marca "Status
// Automação = a corrigir" nas páginas do Notion correspondentes (deixando a
// Instrução de correção vazia, para o runner auto-detectar os campos vazios).

const { getNotionClinicalDrugsConfig } = require('./notionClinicalDrugsSync');
const { writeClinicalDrugToPage } = require('./notionClinicalDrugWriter');
const { COMPLETABLE_FIELDS } = require('../contracts/clinicalDrugAutomation');

const MAX_QUEUE = 50;

function isEmptyValue(value) {
  return value == null || String(value).trim() === '';
}

async function fetchIncompletePublishedDrugs() {
  const { supabaseUrl, serviceRoleKey } = getNotionClinicalDrugsConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Supabase service role não configurado.');
    error.statusCode = 503;
    throw error;
  }

  const columns = ['notion_page_id', 'active_ingredient', ...COMPLETABLE_FIELDS];
  const query = new URLSearchParams({
    select: columns.join(','),
    publication_status: 'eq.published',
    notion_page_id: 'not.is.null',
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/clinical_drugs?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Não foi possível ler o bulário no Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function findMissingFields(row) {
  return COMPLETABLE_FIELDS.filter((field) => isEmptyValue(row[field]));
}

/**
 * Marca páginas de bulas incompletas como "a corrigir" no Notion. NÃO gera
 * conteúdo — só enfileira; o runner é quem completa depois. dryRun apenas lista.
 */
async function queueIncompleteClinicalDrugs({ limit = 10, dryRun = false } = {}) {
  const cap = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), MAX_QUEUE);
  const rows = await fetchIncompletePublishedDrugs();

  const incomplete = rows
    .map((row) => ({ row, missingFields: findMissingFields(row) }))
    .filter((entry) => entry.missingFields.length > 0);

  const selected = incomplete.slice(0, cap);
  const queued = [];
  const errors = [];

  for (const { row, missingFields } of selected) {
    const entry = {
      pageId: row.notion_page_id,
      activeIngredient: row.active_ingredient,
      missingFields,
    };

    if (dryRun) {
      queued.push({ ...entry, queued: false });
      continue;
    }

    try {
      await writeClinicalDrugToPage(
        row.notion_page_id,
        { automation_status: 'a corrigir' },
        { fields: ['automation_status'] },
      );
      queued.push({ ...entry, queued: true });
    } catch (error) {
      errors.push({ ...entry, error: String(error?.message || 'erro desconhecido') });
    }
  }

  return {
    dryRun: Boolean(dryRun),
    totalPublished: rows.length,
    totalIncomplete: incomplete.length,
    queued: queued.length,
    errors: errors.length,
    items: queued,
    errorItems: errors,
  };
}

module.exports = {
  queueIncompleteClinicalDrugs,
  findMissingFields,
  fetchIncompletePublishedDrugs,
};
