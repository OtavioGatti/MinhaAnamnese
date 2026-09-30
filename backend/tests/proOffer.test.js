const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Oferta do Plano Profissional no frontend (ESM), testada daqui porque o
// frontend não tem suíte própria.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'proOffer.js')).href;

test('número do catálogo arredonda para baixo e nunca promete mais do que existe', async () => {
  const { formatCatalogCount } = await import(MODULO);

  assert.equal(formatCatalogCount(568), '560+');
  assert.equal(formatCatalogCount(120), '120');
  assert.equal(formatCatalogCount(113), '110+');
  assert.equal(formatCatalogCount(14), '14');
  assert.equal(formatCatalogCount(1234), '1.230+');
  assert.equal(formatCatalogCount(0), null);
  assert.equal(formatCatalogCount(null), null);
  assert.equal(formatCatalogCount('abc'), null);
});

test('lista do Profissional usa os números do catálogo quando eles chegam', async () => {
  const { buildProFeatureList } = await import(MODULO);
  const lista = buildProFeatureList({
    catalog: { clinicalDrugs: 568, prescriptionGuides: 218, clinicalTools: 114, maneuvers: 113, exams: 120 },
    letterTypeCount: 7,
  });
  const titulo = (key) => lista.find((item) => item.key === key)?.title;

  assert.equal(titulo('clinicalDrugs'), '560+ medicamentos no bulário');
  assert.equal(titulo('prescriptionGuides'), '210+ guias de prescrição');
  assert.equal(titulo('clinicalTools'), '110+ ferramentas clínicas');
  assert.equal(titulo('examination'), '110+ manobras e 120 exames');
  assert.equal(titulo('referralLetters'), '7 tipos de carta e documento com IA');
});

test('sem catálogo a lista continua concreta, só sem número', async () => {
  const { buildProFeatureList } = await import(MODULO);
  const lista = buildProFeatureList({ catalog: null });

  assert.equal(lista.find((item) => item.key === 'clinicalDrugs').title, 'Bulário clínico');
  assert.equal(lista.find((item) => item.key === 'examination').title, 'Manobras de exame físico e exames');
  assert.ok(lista.every((item) => !/undefined|null|NaN/.test(item.title)));
});

test('hipóteses diagnósticas só entram na oferta quando o recurso está ligado', async () => {
  const { buildProFeatureList } = await import(MODULO);

  assert.ok(buildProFeatureList({ hypothesesEnabled: true }).some((item) => item.key === 'diagnosticHypotheses'));
  assert.ok(!buildProFeatureList({ hypothesesEnabled: false }).some((item) => item.key === 'diagnosticHypotheses'));
});

test('uso do teste mostra só o que foi usado, na ordem de peso, com singular e plural', async () => {
  const { summarizeTrialUsage } = await import(MODULO);
  const itens = summarizeTrialUsage({
    clinicalDrugs: 14,
    insights: 6,
    referralLetters: 1,
    userTemplates: 0,
    prescriptionGuides: null,
  });

  assert.deepEqual(itens, [
    { key: 'insights', count: 6, label: 'avaliações completas' },
    { key: 'referralLetters', count: 1, label: 'documento com IA' },
    { key: 'clinicalDrugs', count: 14, label: 'medicamentos no bulário' },
  ]);
  assert.deepEqual(summarizeTrialUsage(null), []);
  assert.deepEqual(summarizeTrialUsage({}), []);
});

test('frase do uso do teste junta até três itens em português', async () => {
  const { describeTrialUsage, summarizeTrialUsage } = await import(MODULO);

  assert.equal(
    describeTrialUsage(summarizeTrialUsage({ insights: 6, referralLetters: 2, clinicalDrugs: 14, clinicalTools: 3 })),
    '6 avaliações completas, 2 documentos com IA e 14 medicamentos no bulário',
  );
  assert.equal(describeTrialUsage(summarizeTrialUsage({ insights: 1 })), '1 avaliação completa');
  assert.equal(
    describeTrialUsage(summarizeTrialUsage({ insights: 2, clinicalTools: 1 })),
    '2 avaliações completas e 1 ferramenta clínica',
  );
  assert.equal(describeTrialUsage([]), '');
});

test('equivalente mensal do semestral considera o desconto e arredonda para baixo', async () => {
  const { estimatePerMonthPrice } = await import(MODULO);

  assert.equal(estimatePerMonthPrice(129.9, 6), 21.65);
  assert.equal(estimatePerMonthPrice(129.9, 6, 0.1), 19.48);
  assert.equal(estimatePerMonthPrice(0, 6), null);
  assert.equal(estimatePerMonthPrice(129.9, 0), null);
});
