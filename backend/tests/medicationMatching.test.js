const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMedicationCsv } = require('../services/medicationDictionary');
const {
  parsePrescriptionMedications,
  matchMedication,
  buildAvailabilityReport,
} = require('../services/medicationAvailability');

const CSV = `nome,principio_ativo,apresentacao,fonte,status,unidade,atualizado_em
Nitrofurantoina,Nitrofurantoina,100 mg comprimido,SUS-Assis,disponivel,Central,2026-06-01
Sulfametoxazol + Trimetoprima,Sulfametoxazol + Trimetoprima,400 mg + 80 mg,SUS-Assis,disponivel,Central,2026-06-01
Fosfomicina trometamol,Fosfomicina trometamol,3 g envelope,Farmacia Popular,em falta,Popular,2026-06-01
Fenazopiridina,Cloridrato de fenazopiridina,100 mg,Particular,em_falta,Privada,2026-06-01`;

const DICTIONARY = parseMedicationCsv(CSV);

test('parseMedicationCsv normaliza status "em falta" -> em_falta', () => {
  const fosfomicina = DICTIONARY.find((row) => row.nome === 'Fosfomicina trometamol');
  assert.equal(fosfomicina.status, 'em_falta');

  const nitro = DICTIONARY.find((row) => row.nome === 'Nitrofurantoina');
  assert.equal(nitro.status, 'disponivel');
});

test('parsePrescriptionMedications extrai nome e dose do formato [N] Nome dose ---- instrução', () => {
  const medications = parsePrescriptionMedications([
    '[1] Nitrofurantoina 100 mg ---- 1 comprimido de 6/6h por 5 dias',
    '[2] Sulfametoxazol + Trimetoprima 400 mg + 80 mg ---- 12/12h por 3 dias',
  ].join('\n'));

  assert.equal(medications.length, 2);
  assert.equal(medications[0].name, 'Nitrofurantoina');
  assert.equal(medications[0].dose, '100 mg');
  assert.equal(medications[0].index, 1);
  assert.equal(medications[1].name, 'Sulfametoxazol + Trimetoprima');
});

test('matchMedication acerta grafia exata e princípio ativo, e rejeita não relacionado', () => {
  const exact = matchMedication('Nitrofurantoina', DICTIONARY);
  assert.equal(exact.record.nome, 'Nitrofurantoina');
  assert.ok(exact.score >= 0.9);

  // casa pelo princípio ativo mesmo com nome comercial diferente
  const byIngredient = matchMedication('Fenazopiridina', DICTIONARY);
  assert.equal(byIngredient.record.nome, 'Fenazopiridina');

  const unrelated = matchMedication('Nimesulida', DICTIONARY);
  assert.ok(unrelated.score < 0.6, `esperado score baixo, veio ${unrelated.score}`);
});

test('buildAvailabilityReport classifica disponivel / em_falta / nao_encontrado', () => {
  const prescription = [
    '[1] Nitrofurantoina 100 mg ---- 6/6h por 5 dias',
    '[2] Fosfomicina trometamol 3 g ---- dose unica',
    '[3] Nimesulida 100 mg ---- 12/12h se dor',
  ].join('\n');

  const report = buildAvailabilityReport(prescription, { dictionary: DICTIONARY });

  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.disponivel, 1);
  assert.equal(report.summary.em_falta, 1);
  assert.equal(report.summary.nao_encontrado, 1);

  const nitro = report.items.find((item) => item.nome_prescrito === 'Nitrofurantoina');
  assert.equal(nitro.classificacao, 'disponivel');
  assert.equal(nitro.correspondencia.fonte, 'SUS-Assis');

  const fosfomicina = report.items.find((item) => item.nome_prescrito.startsWith('Fosfomicina'));
  assert.equal(fosfomicina.classificacao, 'em_falta');

  const nimesulida = report.items.find((item) => item.nome_prescrito === 'Nimesulida');
  assert.equal(nimesulida.classificacao, 'nao_encontrado');
  assert.equal(nimesulida.correspondencia, null);
});

test('itens de ação (sem dose e sem match) não entram no cruzamento', () => {
  const prescription = [
    '[1] Nitrofurantoina 100 mg ---- 6/6h por 5 dias',
    '[2] Manter ouvido seco ---- não molhar a orelha',
    '[3] Encaminhamento ---- encaminhar se piora',
  ].join('\n');

  const report = buildAvailabilityReport(prescription, { dictionary: DICTIONARY });

  assert.equal(report.summary.total, 1); // só a nitrofurantoína conta
  assert.equal(report.summary.disponivel, 1);
  assert.deepEqual(report.naoMedicamentos, ['Manter ouvido seco', 'Encaminhamento']);
});
