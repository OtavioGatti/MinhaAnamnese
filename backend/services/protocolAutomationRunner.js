// Orquestrador do polling da automação de protocolos.
//
// Busca páginas com status_automacao em {a gerar, a corrigir}, despacha
// geração/correção, escreve de volta no Notion e registra auditoria.
// NUNCA marca pronto/revisado (a trava do contrato garante). Em erro, marca a
// página como "erro na automação" para não reprocessar em loop.

const { generateProtocol } = require('./generateProtocol');
const { correctProtocolFromFields } = require('./correctProtocol');
const {
  queryPagesByStatusAutomacao,
  readPageFields,
  writeProtocolToPage,
  updateProtocolPage,
  getProtocolPropertyTypes,
  buildProtocolProperties,
} = require('./notionProtocolWriter');
const { recordAudit } = require('./protocolAuditLog');
const { STATUS_AUTOMACAO_ERRO } = require('../contracts/protocolAutomation');

const TRIGGERS = ['a gerar', 'a corrigir'];
const MAX_PER_RUN = 25;

function clampLimit(limit) {
  const n = Number.parseInt(limit, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_PER_RUN) : 3;
}

async function markPageError(pageId) {
  try {
    const typeMap = await getProtocolPropertyTypes();
    const properties = buildProtocolProperties(
      { status_automacao: STATUS_AUTOMACAO_ERRO },
      typeMap,
      { fields: ['status_automacao'] },
    );
    await updateProtocolPage(pageId, properties);
  } catch (_error) {
    // best-effort: não deixa o erro de marcação derrubar o run
  }
}

async function processPage(page, { dryRun }) {
  const fields = readPageFields(page);
  const pageId = page.id;
  const titulo = fields.titulo || '';
  const action = fields.status_automacao === 'a gerar' ? 'gerar' : 'corrigir';

  try {
    let protocol;
    let writeFields;
    let changedFields;
    let prescriptionWarnings;

    if (action === 'gerar') {
      const result = await generateProtocol({
        titulo,
        especialidade: (fields.especialidade || []).join(', '),
        contexto: (fields.contexto || []).join(', '),
        subcondicao: fields.subcondicao || '',
      });
      protocol = result.protocol;
      writeFields = undefined; // grava o protocolo completo
      changedFields = ['(protocolo completo gerado)'];
      prescriptionWarnings = result.meta.prescriptionWarnings;
    } else {
      const result = await correctProtocolFromFields(fields);
      protocol = result.protocol;
      writeFields = result.writeFields;
      changedFields = result.changedFields;
      prescriptionWarnings = result.meta.prescriptionWarnings;
    }

    let writtenFields = changedFields;
    if (!dryRun) {
      const written = await writeProtocolToPage(pageId, protocol, { fields: writeFields });
      if (action === 'gerar') {
        writtenFields = written.writtenFields;
      }
    }

    const audit = await recordAudit({
      page_id: pageId,
      titulo,
      action,
      ok: true,
      changed_fields: changedFields,
      status_automacao: protocol.status_automacao,
      dry_run: Boolean(dryRun),
    });

    return {
      pageId,
      titulo,
      action,
      ok: true,
      dryRun: Boolean(dryRun),
      changedFields,
      writtenFields,
      newStatusAutomacao: protocol.status_automacao,
      auditPersisted: audit.persisted,
      prescriptionWarnings,
    };
  } catch (error) {
    const message = String(error?.message || 'erro desconhecido');

    if (!dryRun) {
      await markPageError(pageId);
    }

    await recordAudit({
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

async function runProtocolAutomation({ limit = 3, dryRun = false } = {}) {
  const cap = clampLimit(limit);
  const pages = await queryPagesByStatusAutomacao(TRIGGERS, { pageSize: cap });
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
  runProtocolAutomation,
  processPage,
  TRIGGERS,
};
