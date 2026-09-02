const assert = require('node:assert/strict');
const test = require('node:test');

const { shouldTouchLastSeen } = require('../services/profiles');

const AGORA = new Date('2026-09-02T12:00:00Z').getTime();
const UMA_HORA = 60 * 60 * 1000;

test('perfil inexistente nao gera escrita', () => {
  assert.equal(shouldTouchLastSeen(null, AGORA), false);
});

test('primeira vez sempre carimba', () => {
  assert.equal(shouldTouchLastSeen({ last_seen_at: null }, AGORA), true);
});

// A trava existe para nao gravar a cada requisicao autenticada: no free tier
// isso seria uma escrita por chamada de API.
test('so regrava depois de uma hora', () => {
  const recente = new Date(AGORA - UMA_HORA + 60000).toISOString();
  const velho = new Date(AGORA - UMA_HORA - 60000).toISOString();

  assert.equal(shouldTouchLastSeen({ last_seen_at: recente }, AGORA), false, '59 min: nao regrava');
  assert.equal(shouldTouchLastSeen({ last_seen_at: velho }, AGORA), true, '61 min: regrava');
});

test('coluna ausente ou data invalida conta como nunca visto', () => {
  assert.equal(shouldTouchLastSeen({}, AGORA), true, 'antes do SQL ser aplicado');
  assert.equal(shouldTouchLastSeen({ last_seen_at: 'nao-e-data' }, AGORA), true);
});

// Regravar para tras criaria atividade falsa no painel.
test('carimbo no futuro nao e sobrescrito', () => {
  const futuro = new Date(AGORA + 86400000).toISOString();

  assert.equal(shouldTouchLastSeen({ last_seen_at: futuro }, AGORA), false);
});
