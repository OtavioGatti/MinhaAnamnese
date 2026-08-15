// Orquestrador do polling da automação de manobras de exame físico.
//
// Busca páginas com Status Automação em {a gerar, a corrigir}, despacha
// geração/correção, escreve de volta no Notion e registra auditoria. NUNCA
// publica (a trava + o gate do sync garantem). Em erro, marca "erro na
// automação" para não reprocessar em loop.
//
// Espelha services/clinicalDrugAutomationRunner.js.

const { generateManeuver } = require('./generateManeuver');
const { correctManeuverFromFields } = require('./correctManeuver');
const {
  buildManeuverProperties,
  getManeuverPropertyTypes,
  queryManeuverPagesByStatus,
  readManeuverPageFields,
  updateManeuverPage,
  writeManeuverToPage,
} = require('./notionManeuverWriter');
const { recordAudit } = require('./automationAuditLog');
const { STATUS_AUTOMACAO_ERRO } = require('../contracts/maneuverAutomation');

const TRIGGERS = ['a gerar', 'a corrigir'];
const MAX_PER_RUN = 25;
const RESOURCE_TYPE = 'physical_exam_maneuver';

function clampLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_PER_RUN) : 3;
}

async function markPageError(pageId) {
  try {
    const typeMap = await getManeuverPropertyTypes();
    const properties = buildManeuverProperties(
      { automation_status: STATUS_AUTOMACAO_ERRO },
      typeMap,
      { fields: ['automation_status'] },
    );
    await updateManeuverPage(pageId, properties);
  } catch (_error) {
    // best-effort
  }
}

async function processPage(page, { dryRun }) {
  const fields = readManeuverPageFields(page);
  const pageId = page.id;
  const titulo = fields.name || '';
  const action = fields.automation_status === 'a gerar' ? 'gerar' : 'corrigir';

  try {
    let maneuver;
    let writeFields;
    let changedFields;
    let mode;

    if (action === 'gerar') {
      const result = await generateManeuver({ name: titulo });
      maneuver = result.maneuver;
      writeFields = undefined; // grava a manobra completa
      changedFields = ['(manobra completa gerada)'];
    } else {
      const result = await correctManeuverFromFields(fields);
      maneuver = result.maneuver;
      writeFields = result.writeFields;
      changedFields = result.changedFields;
      mode = result.mode;
    }

    let writtenFields = changedFields;

    if (!dryRun) {
      const written = await writeManeuverToPage(pageId, maneuver, { fields: writeFields });

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
      status_automacao: maneuver.automation_status,
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
      newStatusAutomacao: maneuver.automation_status,
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

async function runManeuverAutomation({ limit = 3, dryRun = false } = {}) {
  const cap = clampLimit(limit);
  const pages = await queryManeuverPagesByStatus(TRIGGERS, { pageSize: cap });
  const selected = pages.slice(0, cap);
  const results = [];

  for (const page of selected) {
    // sequencial: cada página faz uma chamada de IA; evita estourar rate limit
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
  runManeuverAutomation,
};
