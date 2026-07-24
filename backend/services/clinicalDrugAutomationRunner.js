// Orquestrador do polling da automação de bulário.
//
// Busca páginas com Status Automação em {a gerar, a corrigir}, despacha
// geração/correção, escreve de volta no Notion e registra auditoria. NUNCA
// publica (a trava + o gate do sync garantem). Em erro, marca "erro na
// automação" para não reprocessar em loop.

const { generateClinicalDrug } = require('./generateClinicalDrug');
const { correctClinicalDrugFromFields } = require('./correctClinicalDrug');
const {
  queryClinicalDrugPagesByStatus,
  readClinicalDrugPageFields,
  writeClinicalDrugToPage,
  updateClinicalDrugPage,
  getClinicalDrugPropertyTypes,
  buildClinicalDrugProperties,
} = require('./notionClinicalDrugWriter');
const { recordAudit } = require('./automationAuditLog');
const { STATUS_AUTOMACAO_ERRO } = require('../contracts/clinicalDrugAutomation');

const TRIGGERS = ['a gerar', 'a corrigir'];
const MAX_PER_RUN = 25;
const RESOURCE_TYPE = 'clinical_drug';

function clampLimit(limit) {
  const n = Number.parseInt(limit, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_PER_RUN) : 3;
}

async function markPageError(pageId) {
  try {
    const typeMap = await getClinicalDrugPropertyTypes();
    const properties = buildClinicalDrugProperties(
      { automation_status: STATUS_AUTOMACAO_ERRO },
      typeMap,
      { fields: ['automation_status'] },
    );
    await updateClinicalDrugPage(pageId, properties);
  } catch (_error) {
    // best-effort
  }
}

async function processPage(page, { dryRun }) {
  const fields = readClinicalDrugPageFields(page);
  const pageId = page.id;
  const titulo = fields.active_ingredient || '';
  const action = fields.automation_status === 'a gerar' ? 'gerar' : 'corrigir';

  try {
    let drug;
    let writeFields;
    let changedFields;
    let mode;

    if (action === 'gerar') {
      const result = await generateClinicalDrug({ activeIngredient: titulo });
      drug = result.drug;
      writeFields = undefined; // grava a bula completa
      changedFields = ['(bula completa gerada)'];
    } else {
      const result = await correctClinicalDrugFromFields(fields);
      drug = result.drug;
      writeFields = result.writeFields;
      changedFields = result.changedFields;
      mode = result.mode;
    }

    let writtenFields = changedFields;
    if (!dryRun) {
      const written = await writeClinicalDrugToPage(pageId, drug, { fields: writeFields });
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
      status_automacao: drug.automation_status,
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
      newStatusAutomacao: drug.automation_status,
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

async function runClinicalDrugAutomation({ limit = 3, dryRun = false } = {}) {
  const cap = clampLimit(limit);
  const pages = await queryClinicalDrugPagesByStatus(TRIGGERS, { pageSize: cap });
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
    generated: results.filter((r) => r.action === 'gerar' && r.ok).length,
    corrected: results.filter((r) => r.action === 'corrigir' && r.ok).length,
    errors: results.filter((r) => !r.ok).length,
    results,
  };
}

module.exports = {
  runClinicalDrugAutomation,
  processPage,
  TRIGGERS,
};
