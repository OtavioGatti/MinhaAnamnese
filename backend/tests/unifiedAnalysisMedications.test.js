const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAcuteCriticalInsight, medicationsDispenseDose } = require('../utils/unifiedAnalysisResponse');

test('uso eventual e suplemento de rotina não precisam de dose', () => {
  for (const texto of [
    'Dipirona, uso eventual.',
    'Dipirona se dor.',
    'Clonazepam em crises.',
    'Salbutamol spray eventual.',
    'Sulfato ferroso e ácido fólico.',
    'Carbonato de cálcio e vitamina D.',
  ]) {
    assert.equal(medicationsDispenseDose(texto), true, texto);
  }
});

test('remédio de uso contínuo continua cobrando dose, mesmo em lista mista', () => {
  for (const texto of [
    'Losartana e metformina.',
    'Losartana, ácido fólico.',
    'Captopril, uso irregular.',
    'Anlodipino (bloqueador de canal de cálcio).',
    'Propranolol, sertralina, levotiroxina, carbonato de cálcio e clonazepam em crises.',
  ]) {
    assert.equal(medicationsDispenseDose(texto), false, texto);
  }
});

test('falha principal diz "sem dose" quando é só isso, e não "medicações ou alergias"', () => {
  const soDose = buildAcuteCriticalInsight({
    key: 'medications',
    section: { status: 'partial', issue: 'Medicações citadas sem dose, frequência ou contexto de uso.' },
  });
  assert.match(soDose, /Medicações citadas sem dose ou frequência/);
  assert.doesNotMatch(soDose, /alergias/i);

  const ausente = buildAcuteCriticalInsight({ key: 'medications', section: { status: 'missing', issue: '' } });
  assert.match(ausente, /Medicações em uso e alergias não documentadas/);
});

test('alergia faltando em outra seção vira "Alergias não documentadas", sem acusar as medicações', () => {
  const texto = buildAcuteCriticalInsight({
    key: 'medications',
    section: { label: 'Antecedentes pessoais e comorbidades', status: 'partial', issue: 'Há registro de cirurgias, mas não de comorbidades e alergias.' },
  });
  assert.match(texto, /Alergias não documentadas/);
  assert.doesNotMatch(texto, /Medicações/);
});
