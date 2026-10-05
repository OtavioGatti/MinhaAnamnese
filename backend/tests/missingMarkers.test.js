const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeMissingMarkers } = require('../utils/missingMarkers');

test('padroniza as grafias de "não relatado" para [Não relatado]', () => {
  // Saída real da geriatria quando o prompt do CMS pedia o marcador sem acento.
  const saida = 'MUC: [nao relatado]\nExames: [NAO RELATADO]\nEF: [Não Relatado]\nConduta: [ não relatada ]';

  assert.equal(
    normalizeMissingMarkers(saida),
    'MUC: [Não relatado]\nExames: [Não relatado]\nEF: [Não relatado]\nConduta: [Não relatado]',
  );
});

test('não mexe em outros marcadores nem em texto clínico sem colchetes', () => {
  const saida = 'HD: [INFORMAÇÃO INSUFICIENTE]\nMUC: [DADO AUSENTE]\nHDA: Febre não relatada pela acompanhante.';

  assert.equal(normalizeMissingMarkers(saida), saida);
});
