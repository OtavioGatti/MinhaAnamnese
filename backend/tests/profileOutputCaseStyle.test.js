const assert = require('node:assert/strict');
const test = require('node:test');
const { buildProfileFallback, normalizeOutputCaseStyle } = require('../services/profiles');

test('normalizeOutputCaseStyle aceita apenas mixed/upper e cai em mixed por padrão', () => {
  assert.equal(normalizeOutputCaseStyle('upper'), 'upper');
  assert.equal(normalizeOutputCaseStyle('mixed'), 'mixed');
  assert.equal(normalizeOutputCaseStyle(undefined), 'mixed');
  assert.equal(normalizeOutputCaseStyle(null), 'mixed');
  assert.equal(normalizeOutputCaseStyle('qualquer-coisa'), 'mixed');
});

test('buildProfileFallback preserva output_case_style existente e aceita override', () => {
  const user = { id: '11111111-1111-1111-1111-111111111111', email: 'medico@example.com' };

  const withoutPreference = buildProfileFallback(user, null, {});
  assert.equal(withoutPreference.output_case_style, 'mixed');

  const existingProfile = { output_case_style: 'upper' };
  const preserved = buildProfileFallback(user, existingProfile, {});
  assert.equal(preserved.output_case_style, 'upper');

  const overridden = buildProfileFallback(user, existingProfile, { output_case_style: 'mixed' });
  assert.equal(overridden.output_case_style, 'mixed');
});
