const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');

const ANAMNESE_COMPLETA = [
  'Queixa principal: dor abdominal ha 2 dias.',
  'HDA: paciente refere dor em epigastrio, associada a nauseas, sem vomitos, sem febre.',
  'Antecedentes: hipertensao em uso de losartana.',
  'Alergias: nega alergias medicamentosas.',
  'Exame fisico: BEG, abdome doloroso a palpacao em epigastrio, sem sinais de irritacao peritoneal. PA 130/80, FC 82.',
  'Hipotese diagnostica: dispepsia.',
  'Conduta: solicito endoscopia, oriento retorno se piora.',
].join('\n');

const ANAMNESE_ESPARSA = 'Paciente com dor.';

test('texto vazio não gera score', () => {
  const result = calculateAnamnesisQualityScore('', 'clinica_medica');

  assert.equal(result.score, null);
  assert.deepEqual(result.sections, []);
  assert.equal(result.structuredAnalysis, null);
});

test('template desconhecido não gera score', () => {
  const result = calculateAnamnesisQualityScore(ANAMNESE_COMPLETA, 'template_inexistente');

  assert.equal(result.score, null);
});

test('anamnese completa pontua alto com poucas lacunas essenciais', () => {
  const result = calculateAnamnesisQualityScore(ANAMNESE_COMPLETA, 'clinica_medica');

  assert.equal(typeof result.score, 'number');
  assert.ok(result.score >= 50, `score esperado >= 50, obtido ${result.score}`);
  assert.ok(result.score <= 100, `score esperado <= 100, obtido ${result.score}`);
  assert.ok(result.sections.length > 0);
  assert.ok(result.missingEssentialSections.length <= 2);
  assert.ok(result.structuredAnalysis);
});

test('anamnese esparsa pontua baixo e lista lacunas essenciais', () => {
  const sparse = calculateAnamnesisQualityScore(ANAMNESE_ESPARSA, 'clinica_medica');
  const complete = calculateAnamnesisQualityScore(ANAMNESE_COMPLETA, 'clinica_medica');

  assert.equal(typeof sparse.score, 'number');
  assert.ok(sparse.score <= 40, `score esperado <= 40, obtido ${sparse.score}`);
  assert.ok(sparse.missingEssentialSections.length >= 2);
  assert.ok(sparse.score < complete.score, 'anamnese esparsa deve pontuar abaixo da completa');
});
