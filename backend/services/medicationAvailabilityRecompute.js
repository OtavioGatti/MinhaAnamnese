// Recalculo determinístico (SEM IA) da disponibilidade de medicamentos em todos
// os protocolos. Quando o dicionário de Assis é atualizado, gera um relatório
// dos "protocolos que citam medicamento agora em falta" para revisão manual.
// NUNCA reescreve o texto clínico — só relata.

const { queryNotionPrescriptionGuidePages } = require('./notionPrescriptionGuideSync');
const { readPageFields } = require('./notionProtocolWriter');
const { buildAvailabilityReport } = require('./medicationAvailability');
const { getMedicationDictionary } = require('./medicationDictionary');

async function recomputeAvailability({ onlyEmFalta = true } = {}) {
  const pages = await queryNotionPrescriptionGuidePages();
  const dictionary = getMedicationDictionary();
  const protocols = [];

  for (const page of pages) {
    const fields = readPageFields(page);
    const titulo = fields.titulo || '';
    const prescription = fields.texto_copiavel_prescricao || fields.prescricao_medicamentos || '';

    if (!prescription) {
      continue;
    }

    const report = buildAvailabilityReport(prescription, { dictionary });
    const emFalta = report.items.filter((item) => item.classificacao === 'em_falta');
    const naoEncontrado = report.items.filter((item) => item.classificacao === 'nao_encontrado');

    protocols.push({
      pageId: page.id,
      titulo,
      summary: report.summary,
      emFalta: emFalta.map((item) => ({
        nome_prescrito: item.nome_prescrito,
        correspondencia: item.correspondencia?.nome || null,
        unidade: item.correspondencia?.unidade || null,
      })),
      naoEncontrado: naoEncontrado.map((item) => item.nome_prescrito),
    });
  }

  const comMedicamentoEmFalta = protocols.filter((p) => p.summary.em_falta > 0);

  return {
    dictionarySize: dictionary.length,
    totalProtocols: protocols.length,
    protocolsComMedicamentoEmFalta: comMedicamentoEmFalta.length,
    protocols: onlyEmFalta ? comMedicamentoEmFalta : protocols,
  };
}

module.exports = {
  recomputeAvailability,
};
