// Enfileira manobras incompletas para o modo auto-completar: varre o Supabase
// por manobras publicadas com campos de conteúdo vazios e marca "Status
// Automação = a corrigir" nas páginas do Notion correspondentes (deixando a
// Instrução de correção vazia, para o runner auto-detectar os campos vazios).
//
// Espelha services/clinicalDrugQueue.js.

const { getConfig } = require('./notionPhysicalExamManeuversSync');
const { writeManeuverToPage } = require('./notionManeuverWriter');
const { QUEUEABLE_FIELDS } = require('../contracts/maneuverAutomation');

const MAX_QUEUE = 50;

function isEmptyValue(value) {
  return value == null || String(value).trim() === '';
}

async function fetchIncompletePublishedManeuvers() {
  const { supabaseUrl, serviceRoleKey } = getConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Supabase service role não configurado.');
    error.statusCode = 503;
    throw error;
  }

  const columns = ['notion_page_id', 'name', ...QUEUEABLE_FIELDS];
  const query = new URLSearchParams({
    select: columns.join(','),
    status: 'eq.published',
    notion_page_id: 'not.is.null',
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/physical_exam_maneuvers?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Não foi possível ler o catálogo de manobras no Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function findMissingFields(row) {
  return QUEUEABLE_FIELDS.filter((field) => isEmptyValue(row[field]));
}

/**
 * Marca páginas de manobras incompletas como "a corrigir" no Notion. NÃO gera
 * conteúdo — só enfileira; o runner é quem completa depois. dryRun apenas lista.
 */
async function queueIncompleteManeuvers({ limit = 10, dryRun = false } = {}) {
  const cap = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), MAX_QUEUE);
  const rows = await fetchIncompletePublishedManeuvers();

  const incomplete = rows
    .map((row) => ({ row, missingFields: findMissingFields(row) }))
    .filter((entry) => entry.missingFields.length > 0);

  const selected = incomplete.slice(0, cap);
  const queued = [];
  const errors = [];

  for (const { row, missingFields } of selected) {
    const entry = {
      pageId: row.notion_page_id,
      name: row.name,
      missingFields,
    };

    if (dryRun) {
      queued.push({ ...entry, queued: false });
      continue;
    }

    try {
      await writeManeuverToPage(
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
  fetchIncompletePublishedManeuvers,
  findMissingFields,
  queueIncompleteManeuvers,
};
