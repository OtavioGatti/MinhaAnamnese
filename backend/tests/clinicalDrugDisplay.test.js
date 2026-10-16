const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Exibição da bula (frontend, ESM): fonte única da página e da consulta rápida.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'clinicalDrugDisplay.js')).href;

test('lista nunca parte a dose no ";" de dentro da linha', async () => {
  const { splitListText } = await import(MODULO);
  const posologia = '- Comprimido 500 mg: 1 a 2 comprimidos.\n- Gotas 500 mg/mL (1 mL = 20 gotas; 1 gota = 25 mg): 20 a 40 gotas.';

  assert.deepEqual(splitListText(posologia), [
    'Comprimido 500 mg: 1 a 2 comprimidos.',
    'Gotas 500 mg/mL (1 mL = 20 gotas; 1 gota = 25 mg): 20 a 40 gotas.',
  ]);
  // Texto corrido numa linha só continua separando no ";" (nomes comerciais).
  assert.deepEqual(splitListText('Novalgina; Anador; Magnopyrol'), ['Novalgina', 'Anador', 'Magnopyrol']);
});

test('essencial da consulta rápida: posologia adulto, pediátrica e contraindicações, sem repetir nas abas', async () => {
  const { buildSectionsByTab, ESSENTIAL_SECTION_KEYS, getEssentialSections } = await import(MODULO);
  const drug = {
    adultDosage: '500 mg',
    pediatricDosage: '10 mg/kg',
    contraindications: 'Alergia',
    summaryText: 'Resumo',
    warnings: 'Cuidado',
    monograph: { renalAdjustment: 'Reduzir', indications: 'Dor' },
  };

  assert.deepEqual(getEssentialSections(drug).map((s) => s.key), ['adultDosage', 'pediatricDosage', 'contraindications']);
  const abas = buildSectionsByTab(drug, { exclude: ESSENTIAL_SECTION_KEYS });
  assert.deepEqual(abas.principal.map((s) => s.key), ['summary', 'indications']);
  assert.deepEqual(abas.ajustes.map((s) => s.key), ['renalAdjustment']);
  assert.deepEqual(abas.cuidados.map((s) => s.key), ['warnings']);
});

test('seções vazias somem, e a página completa continua com todas', async () => {
  const { buildSectionsByTab, buildDrugSections } = await import(MODULO);
  const antiga = { adultDosage: '500 mg', contraindications: 'Alergia', monograph: {} };

  assert.deepEqual(buildDrugSections(antiga).map((s) => s.key), ['adultDosage', 'contraindications']);
  assert.equal(buildSectionsByTab(antiga).ajustes.length, 0);
});

test('gestação usa o rótulo novo da bula; revisão diz em que dá para confiar', async () => {
  const { getPregnancyLabel, getReviewState } = await import(MODULO);

  assert.equal(getPregnancyLabel({ pregnancyRisk: 'D', monograph: { pregnancyRiskLabel: 'Evitar no 1º trimestre' } }), 'Evitar no 1º trimestre');
  assert.equal(getPregnancyLabel({ pregnancyRisk: 'D' }), 'D');
  assert.equal(getReviewState({ monograph: { clinicalReviewStatus: 'Revisado por médico', reviewedBy: 'Dr. X' } }).tone, 'success');
  assert.equal(getReviewState({ monograph: { clinicalReviewStatus: 'Aguardando revisão' } }).tone, 'warning');
  assert.equal(getReviewState({ monograph: { clinicalReviewStatus: 'Precisa correção' } }).tone, 'danger');
  assert.equal(getReviewState({}).tone, 'neutral');
});
