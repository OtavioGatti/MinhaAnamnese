const assert = require('node:assert/strict');
const test = require('node:test');

process.env.PAYOUT_ACTION_SECRET = 'segredo-de-teste-para-acoes-de-saque';

const {
  buildPayoutActionUrls,
  createPayoutActionToken,
  verifyPayoutActionToken,
} = require('../utils/payoutActionToken');

const PAYOUT_ID = '6e51255c-6f72-4a5b-b357-8bcbdce62a73';

test('token válido é aceito para o mesmo saque e ação', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid');

  assert.ok(token && token.sig && token.exp);
  assert.equal(
    verifyPayoutActionToken({ payoutId: PAYOUT_ID, action: 'paid', exp: token.exp, sig: token.sig }),
    true,
  );
});

test('token de uma ação não vale para a outra (paid != rejected)', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid');

  assert.equal(
    verifyPayoutActionToken({ payoutId: PAYOUT_ID, action: 'rejected', exp: token.exp, sig: token.sig }),
    false,
  );
});

test('token de um saque não vale para outro', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid');

  assert.equal(
    verifyPayoutActionToken({
      payoutId: '00000000-0000-0000-0000-000000000000',
      action: 'paid',
      exp: token.exp,
      sig: token.sig,
    }),
    false,
  );
});

test('assinatura adulterada é rejeitada', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid');

  assert.equal(
    verifyPayoutActionToken({ payoutId: PAYOUT_ID, action: 'paid', exp: token.exp, sig: `${token.sig}00` }),
    false,
  );
  assert.equal(
    verifyPayoutActionToken({ payoutId: PAYOUT_ID, action: 'paid', exp: token.exp, sig: 'deadbeef' }),
    false,
  );
});

test('token expirado é rejeitado', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid', -1000);

  assert.equal(
    verifyPayoutActionToken({ payoutId: PAYOUT_ID, action: 'paid', exp: token.exp, sig: token.sig }),
    false,
  );
});

test('exp alterado invalida o token (não dá para estender validade)', () => {
  const token = createPayoutActionToken(PAYOUT_ID, 'paid');

  assert.equal(
    verifyPayoutActionToken({
      payoutId: PAYOUT_ID,
      action: 'paid',
      exp: token.exp + 1000,
      sig: token.sig,
    }),
    false,
  );
});

test('buildPayoutActionUrls gera os dois links com a URL pública', () => {
  process.env.PUBLIC_API_URL = 'https://minhaanamnese.onrender.com';
  const urls = buildPayoutActionUrls(PAYOUT_ID);

  assert.ok(urls.paid.startsWith('https://minhaanamnese.onrender.com/api/affiliate-payout-action?'));
  assert.ok(urls.paid.includes('action=paid'));
  assert.ok(urls.rejected.includes('action=rejected'));
  assert.ok(urls.paid.includes(`payout=${PAYOUT_ID}`));
});

test('buildPayoutActionUrls normaliza base terminando em /api', () => {
  process.env.PUBLIC_API_URL = 'https://minhaanamnese.onrender.com/api';
  const urls = buildPayoutActionUrls(PAYOUT_ID);

  assert.ok(urls.paid.startsWith('https://minhaanamnese.onrender.com/api/affiliate-payout-action?'));
  assert.ok(!urls.paid.includes('/api/api/'));
});
