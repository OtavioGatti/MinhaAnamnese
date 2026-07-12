const assert = require('node:assert/strict');
const test = require('node:test');
const {
  matchOfficialSection,
  scoreOfficialSectionMatch,
} = require('../utils/templateSectionMatching');
const { buildCustomEvaluation } = require('../services/userTemplates');
const { normalizeCustomTemplateEnrichment } = require('../contracts/customTemplateEnrichment');

const OFFICIAL_EVALUATION = {
  sensitivity: 'ambulatory',
  severitySignals: ['dispneia', 'sangramento'],
  sections: [
    {
      id: 'queixa_principal',
      label: 'Queixa principal',
      weight: 12,
      priority: 'essential',
      aliases: ['queixa principal', 'qp', 'qpd'],
      evidence: ['dor', 'febre', 'tosse'],
    },
    {
      id: 'hma',
      label: 'História da moléstia atual (HDA)',
      weight: 18,
      priority: 'essential',
      aliases: ['hda', 'hma', 'historia da molestia atual'],
      evidence: ['há', 'desde', 'início'],
      narrative: true,
    },
    {
      id: 'exame_fisico',
      label: 'Exame físico',
      weight: 10,
      priority: 'important',
      aliases: ['exame fisico', 'ef'],
      evidence: ['pa', 'fc', 'ausculta'],
      vitals: true,
    },
  ],
};

test('matchOfficialSection casa rótulos livres com a seção oficial', () => {
  assert.equal(matchOfficialSection('Queixa', OFFICIAL_EVALUATION.sections)?.id, 'queixa_principal');
  assert.equal(matchOfficialSection('HMA do paciente', OFFICIAL_EVALUATION.sections)?.id, 'hma');
  assert.equal(matchOfficialSection('Exame físico geral', OFFICIAL_EVALUATION.sections)?.id, 'exame_fisico');
  assert.equal(matchOfficialSection('Plano terapêutico', OFFICIAL_EVALUATION.sections), null);
});

test('scoreOfficialSectionMatch dá 1 para rótulo/alias idêntico', () => {
  assert.equal(scoreOfficialSectionMatch('queixa principal', OFFICIAL_EVALUATION.sections[0]), 1);
  assert.equal(scoreOfficialSectionMatch('QP', OFFICIAL_EVALUATION.sections[0]), 1);
});

test('herança (A): seção custom recebe evidence/priority/narrative do oficial', () => {
  const evaluation = buildCustomEvaluation(['Queixa', 'HMA', 'Exame'], OFFICIAL_EVALUATION, null);

  // Queixa herda os termos clínicos reais, não apenas a palavra "queixa".
  assert.ok(evaluation.sections[0].evidence.includes('dor'));
  assert.ok(evaluation.sections[0].evidence.includes('febre'));
  // HMA herda priority essential + narrative.
  assert.equal(evaluation.sections[1].priority, 'essential');
  assert.equal(evaluation.sections[1].narrative, true);
  // Exame herda vitals.
  assert.equal(evaluation.sections[2].vitals, true);
});

test('pesos são renormalizados por prioridade e somam 100', () => {
  const evaluation = buildCustomEvaluation(['Queixa', 'HMA', 'Exame'], OFFICIAL_EVALUATION, null);
  const total = evaluation.sections.reduce((sum, section) => sum + section.weight, 0);

  assert.ok(Math.abs(total - 100) < 0.5, `soma dos pesos deveria ser ~100, obtido ${total}`);
  // Seções essenciais pesam mais que a importante.
  assert.ok(evaluation.sections[0].weight > evaluation.sections[2].weight);
});

test('enriquecimento por IA (D) tem precedência sobre a herança', () => {
  const enrichment = normalizeCustomTemplateEnrichment(
    {
      severitySignals: ['choque'],
      sections: [
        { label: 'Queixa', priority: 'essential', aliases: ['qx'], evidence: ['prurido'], guidance: ['Registrar a queixa espontânea.'] },
      ],
    },
    ['Queixa', 'HMA', 'Exame'],
  );
  const evaluation = buildCustomEvaluation(['Queixa', 'HMA', 'Exame'], OFFICIAL_EVALUATION, enrichment);

  // A evidência enriquecida entra e ainda mescla com a herança do oficial.
  assert.ok(evaluation.sections[0].evidence.includes('prurido'));
  assert.deepEqual(evaluation.severitySignals, ['choque']);
});

test('contrato ignora seções que não existem no template e limita listas', () => {
  const enrichment = normalizeCustomTemplateEnrichment(
    {
      sections: [
        { label: 'Seção inventada', priority: 'essential', aliases: [], evidence: [], guidance: [] },
        { label: 'Queixa', priority: 'invalida', aliases: Array(20).fill('x'), evidence: [], guidance: [] },
      ],
    },
    ['Queixa'],
  );

  assert.equal(enrichment.sections.length, 1);
  assert.equal(enrichment.sections[0].label, 'Queixa');
  assert.equal(enrichment.sections[0].priority, 'contextual'); // prioridade inválida -> default
  assert.ok(enrichment.sections[0].aliases.length <= 8);
});
