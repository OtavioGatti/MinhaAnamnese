const assert = require('node:assert/strict');
const test = require('node:test');

const { buildProfileFallback, normalizeTipsSeen } = require('../services/profiles');

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'a@b.c' };

test('normalizeTipsSeen aceita só ids curtos, sem repetição', () => {
  assert.deepEqual(normalizeTipsSeen(['frases_prontas', 'frases_prontas', ' arroba ', 'X!', 42, '']), ['frases_prontas', 'arroba']);
  assert.deepEqual(normalizeTipsSeen('["hipoteses"]'), ['hipoteses']);
  assert.deepEqual(normalizeTipsSeen('nao é json'), []);
  assert.deepEqual(normalizeTipsSeen(null), []);
  assert.equal(normalizeTipsSeen(Array.from({ length: 80 }, (_, i) => `d${i}`)).length, 50);
});

test('tips_seen_add soma ao que já estava gravado, sem apagar', () => {
  const existing = { id: user.id, tips_seen: ['frases_prontas'] };
  const profile = buildProfileFallback(user, existing, { tips_seen_add: ['arroba', 'frases_prontas'] });

  assert.deepEqual(profile.tips_seen, ['frases_prontas', 'arroba']);
});

test('sem override, tips_seen vem do perfil gravado; perfil novo começa vazio', () => {
  assert.deepEqual(buildProfileFallback(user, { id: user.id, tips_seen: ['cartas'] }, {}).tips_seen, ['cartas']);
  assert.deepEqual(buildProfileFallback(user, null, {}).tips_seen, []);
});
