const assert = require('node:assert/strict');
const test = require('node:test');

const { mapNotionPageToManeuver } = require('../services/notionPhysicalExamManeuversSync');
const { mapNotionPageToExam } = require('../services/notionDiagnosticExamsSync');

// Bug real: 60 manobras e 60 exames entraram com display_order 0 porque a
// propriedade "Order" ficou vazia no Notion. `Number('')` é 0 (não NaN), então
// `Number.isFinite` aprovava e o fallback de 1000 nunca valia. Ordem 0 vem
// antes de quem tem ordem definida, e o conteúdo curado (10/20/30) foi
// empurrado para fora da janela de 60 itens da lista.

function buildPage(orderProperty) {
  return {
    id: 'page-1',
    last_edited_time: '2026-08-17T00:00:00.000Z',
    properties: {
      Name: { title: [{ plain_text: 'Sinal de Murphy' }] },
      Order: orderProperty,
    },
  };
}

test('Order vazia no Notion cai no fallback, não em zero', () => {
  const semValor = mapNotionPageToManeuver(buildPage({ type: 'number', number: null }));
  assert.equal(semValor.displayOrder, 1000, 'number null deve usar o fallback');

  const semPropriedade = mapNotionPageToManeuver({ id: 'p', properties: { Name: { title: [] } } });
  assert.equal(semPropriedade.displayOrder, 1000, 'propriedade ausente deve usar o fallback');
});

test('Order preenchida continua sendo respeitada, inclusive zero explícito', () => {
  const dez = mapNotionPageToManeuver(buildPage({ type: 'number', number: 10 }));
  assert.equal(dez.displayOrder, 10);

  // Zero digitado de propósito é uma ordem válida — o fallback não pode roubá-lo.
  const zeroExplicito = mapNotionPageToManeuver(buildPage({ type: 'number', number: 0 }));
  assert.equal(zeroExplicito.displayOrder, 0);
});

test('exames têm o mesmo comportamento das manobras', () => {
  const vazio = mapNotionPageToExam(buildPage({ type: 'number', number: null }));
  assert.equal(vazio.displayOrder, 1000);

  const definido = mapNotionPageToExam(buildPage({ type: 'number', number: 20 }));
  assert.equal(definido.displayOrder, 20);
});

test('conteúdo curado fica na frente do lote sem ordem definida', () => {
  const curado = mapNotionPageToManeuver(buildPage({ type: 'number', number: 30 }));
  const doLote = mapNotionPageToManeuver(buildPage({ type: 'number', number: null }));

  assert.ok(
    curado.displayOrder < doLote.displayOrder,
    'ordem definida deve preceder ordem ausente — era o inverso disso que escondia o Sinal de Murphy',
  );
});
