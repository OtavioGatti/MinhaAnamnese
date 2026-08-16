// Enfileira exames incompletos para o modo auto-completar.
// Espelha services/maneuverQueue.js.

const { getConfig } = require('./notionDiagnosticExamsSync');
const { writeExamToPage } = require('./notionExamWriter');
const { QUEUEABLE_FIELDS } = require('../contracts/examAutomation');

const MAX_QUEUE = 50;

function isEmptyValue(value) {
  return value == null || String(value).trim() === '';
}

async function fetchIncompletePublishedExams() {
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

  const response = await fetch(`${supabaseUrl}/rest/v1/diagnostic_exams?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const error = new Error('Não foi possível ler o catálogo de exames no Supabase.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function findMissingFields(row) {
  return QUEUEABLE_FIELDS.filter((field) => isEmptyValue(row[field]));
}

async function queueIncompleteExams({ limit = 10, dryRun = false } = {}) {
  const cap = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), MAX_QUEUE);
  const rows = await fetchIncompletePublishedExams();

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
      await writeExamToPage(
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
  fetchIncompletePublishedExams,
  findMissingFields,
  queueIncompleteExams,
};
