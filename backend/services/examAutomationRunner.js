// Orquestrador do polling da automação de exames complementares.
// Espelha services/maneuverAutomationRunner.js.

const { generateExam } = require('./generateExam');
const { correctExamFromFields } = require('./correctExam');
const {
  buildExamProperties,
  getExamPropertyTypes,
  queryExamPagesByStatus,
  readExamPageFields,
  updateExamPage,
  writeExamToPage,
} = require('./notionExamWriter');
const { recordAudit } = require('./automationAuditLog');
const { STATUS_AUTOMACAO_ERRO } = require('../contracts/examAutomation');

const TRIGGERS = ['a gerar', 'a corrigir'];
const MAX_PER_RUN = 25;
const RESOURCE_TYPE = 'diagnostic_exam';

function clampLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_PER_RUN) : 3;
}

async function markPageError(pageId) {
  try {
    const typeMap = await getExamPropertyTypes();
    const properties = buildExamProperties(
      { automation_status: STATUS_AUTOMACAO_ERRO },
      typeMap,
      { fields: ['automation_status'] },
    );
    await updateExamPage(pageId, properties);
  } catch (_error) {
    // best-effort
  }
}

async function processPage(page, { dryRun }) {
  const fields = readExamPageFields(page);
  const pageId = page.id;
  const titulo = fields.name || '';
  const action = fields.automation_status === 'a gerar' ? 'gerar' : 'corrigir';

  try {
    let exam;
    let writeFields;
    let changedFields;
    let mode;

    if (action === 'gerar') {
      const result = await generateExam({ name: titulo });
      exam = result.exam;
      writeFields = undefined;
      changedFields = ['(exame completo gerado)'];
    } else {
      const result = await correctExamFromFields(fields);
      exam = result.exam;
      writeFields = result.writeFields;
      changedFields = result.changedFields;
      mode = result.mode;
    }

    let writtenFields = changedFields;

    if (!dryRun) {
      const written = await writeExamToPage(pageId, exam, { fields: writeFields });

      if (action === 'gerar') {
        writtenFields = written.writtenFields;
      }
    }

    await recordAudit({
      resource_type: RESOURCE_TYPE,
      page_id: pageId,
      titulo,
      action,
      ok: true,
      changed_fields: changedFields,
      status_automacao: exam.automation_status,
      dry_run: Boolean(dryRun),
    });

    return {
      pageId,
      titulo,
      action,
      mode,
      ok: true,
      dryRun: Boolean(dryRun),
      changedFields,
      writtenFields,
      newStatusAutomacao: exam.automation_status,
    };
  } catch (error) {
    const message = String(error?.message || 'erro desconhecido');

    if (!dryRun) {
      await markPageError(pageId);
    }

    await recordAudit({
      resource_type: RESOURCE_TYPE,
      page_id: pageId,
      titulo,
      action,
      ok: false,
      error: message,
      status_automacao: STATUS_AUTOMACAO_ERRO,
      dry_run: Boolean(dryRun),
    });

    return { pageId, titulo, action, ok: false, error: message };
  }
}

async function runExamAutomation({ limit = 3, dryRun = false } = {}) {
  const cap = clampLimit(limit);
  const pages = await queryExamPagesByStatus(TRIGGERS, { pageSize: cap });
  const selected = pages.slice(0, cap);
  const results = [];

  for (const page of selected) {
    results.push(await processPage(page, { dryRun }));
  }

  return {
    dryRun: Boolean(dryRun),
    found: pages.length,
    processed: results.length,
    generated: results.filter((result) => result.action === 'gerar' && result.ok).length,
    corrected: results.filter((result) => result.action === 'corrigir' && result.ok).length,
    errors: results.filter((result) => !result.ok).length,
    results,
  };
}

module.exports = {
  TRIGGERS,
  processPage,
  runExamAutomation,
};
