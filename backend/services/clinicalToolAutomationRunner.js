// Orquestrador do polling da automação de ferramentas clínicas.
// Espelha services/examAutomationRunner.js, com uma diferença central:
// aqui a geração pode ser REPROVADA pelo validador do catálogo. Quando isso
// acontece, a página vira "erro na automação" com os erros escritos em "Erros
// de validação" — e a lógica gerada NÃO é escrita. Publicar uma calculadora que
// não valida é o único desfecho que este runner nunca permite.

const { generateClinicalTool } = require('./generateClinicalTool');
const {
  buildClinicalToolProperties,
  getClinicalToolPropertyTypes,
  queryClinicalToolPagesByStatus,
  readClinicalToolPageFields,
  updateClinicalToolPage,
  writeClinicalToolToPage,
} = require('./notionClinicalToolWriter');
const { recordAudit } = require('./automationAuditLog');
const { STATUS_AUTOMACAO_ERRO } = require('../contracts/clinicalToolAutomation');

const TRIGGERS = ['a gerar'];
const MAX_PER_RUN = 15;
const RESOURCE_TYPE = 'clinical_tool';

function clampLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_PER_RUN) : 3;
}

// Marca a página como erro e registra o motivo legível para quem for revisar.
async function markPageError(pageId, errors = []) {
  try {
    const typeMap = await getClinicalToolPropertyTypes();
    const properties = buildClinicalToolProperties(
      {
        automation_status: STATUS_AUTOMACAO_ERRO,
        validation_errors: errors.length > 0 ? errors.join('\n') : 'erro desconhecido',
      },
      typeMap,
      { fields: ['automation_status', 'validation_errors'] },
    );
    await updateClinicalToolPage(pageId, properties);
  } catch (_error) {
    // best-effort
  }
}

async function processPage(page, { dryRun }) {
  const fields = readClinicalToolPageFields(page);
  const pageId = page.id;
  const titulo = fields.title || '';

  try {
    const { tool, validation } = await generateClinicalTool({ name: titulo });

    // PORTÃO: sem validação aprovada, não vira conteúdo.
    if (!validation.valid) {
      if (!dryRun) {
        await markPageError(pageId, validation.errors);
      }

      await recordAudit({
        resource_type: RESOURCE_TYPE,
        page_id: pageId,
        titulo,
        action: 'gerar',
        ok: false,
        error: `reprovado na validação: ${validation.errors.join('; ')}`,
        status_automacao: STATUS_AUTOMACAO_ERRO,
        dry_run: Boolean(dryRun),
      });

      return {
        pageId,
        titulo,
        action: 'gerar',
        ok: false,
        rejected: true,
        validationErrors: validation.errors,
      };
    }

    let writtenFields = ['(ferramenta completa gerada)'];

    if (!dryRun) {
      const written = await writeClinicalToolToPage(pageId, {
        ...tool,
        validation_errors: '',
      });
      writtenFields = written.writtenFields;
    }

    await recordAudit({
      resource_type: RESOURCE_TYPE,
      page_id: pageId,
      titulo,
      action: 'gerar',
      ok: true,
      changed_fields: ['(ferramenta completa gerada)'],
      status_automacao: tool.automation_status,
      dry_run: Boolean(dryRun),
    });

    return {
      pageId,
      titulo,
      action: 'gerar',
      ok: true,
      dryRun: Boolean(dryRun),
      toolType: tool.tool_type,
      fieldCount: tool.fields.length,
      rangeCount: tool.result_ranges.length,
      writtenFields,
      newStatusAutomacao: tool.automation_status,
    };
  } catch (error) {
    const message = String(error?.message || 'erro desconhecido');

    if (!dryRun) {
      await markPageError(pageId, [message]);
    }

    await recordAudit({
      resource_type: RESOURCE_TYPE,
      page_id: pageId,
      titulo,
      action: 'gerar',
      ok: false,
      error: message,
      status_automacao: STATUS_AUTOMACAO_ERRO,
      dry_run: Boolean(dryRun),
    });

    return { pageId, titulo, action: 'gerar', ok: false, error: message };
  }
}

async function runClinicalToolAutomation({ limit = 3, dryRun = false } = {}) {
  const cap = clampLimit(limit);
  const pages = await queryClinicalToolPagesByStatus(TRIGGERS, { pageSize: cap });
  const selected = pages.slice(0, cap);
  const results = [];

  for (const page of selected) {
    results.push(await processPage(page, { dryRun }));
  }

  return {
    dryRun: Boolean(dryRun),
    found: pages.length,
    processed: results.length,
    generated: results.filter((result) => result.ok).length,
    rejected: results.filter((result) => result.rejected).length,
    errors: results.filter((result) => !result.ok && !result.rejected).length,
    results,
  };
}

module.exports = {
  TRIGGERS,
  processPage,
  runClinicalToolAutomation,
};
