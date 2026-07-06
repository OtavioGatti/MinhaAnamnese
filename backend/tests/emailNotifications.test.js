const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.RESEND_API_KEY;

const { isEmailConfigured, sendEmail } = require('../services/emailNotifications');

test('isEmailConfigured é false sem RESEND_API_KEY', () => {
  assert.equal(isEmailConfigured(), false);
});

test('sendEmail falha graciosamente (não lança) sem RESEND_API_KEY configurada', async () => {
  const result = await sendEmail({ to: 'medico@exemplo.com', subject: 'Assunto', html: '<p>corpo</p>' });
  assert.equal(result.ok, false);
  assert.match(result.error, /RESEND_API_KEY/);
});

test('sendEmail valida parâmetros obrigatórios antes de tentar enviar', async () => {
  process.env.RESEND_API_KEY = 'fake-key-para-passar-da-checagem-de-config';

  try {
    assert.equal((await sendEmail({ to: '', subject: 'x', html: '<p>x</p>' })).ok, false);
    assert.equal((await sendEmail({ to: 'a@b.com', subject: '', html: '<p>x</p>' })).ok, false);
    assert.equal((await sendEmail({ to: 'a@b.com', subject: 'x', html: '' })).ok, false);
  } finally {
    delete process.env.RESEND_API_KEY;
  }
});
