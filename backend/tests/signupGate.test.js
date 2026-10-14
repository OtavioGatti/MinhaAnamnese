const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Regras do cadastro como porta de entrada (frontend, ESM).
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'signupGate.js')).href;

test('trava do organizar: chave liga para todos; ?exigir_login liga e desliga neste navegador', async () => {
  const { resolveOrganizeLoginRequired } = await import(MODULO);

  assert.equal(resolveOrganizeLoginRequired({ flag: 'on' }).required, true);
  assert.equal(resolveOrganizeLoginRequired({ flag: '' }).required, false);
  assert.deepEqual(resolveOrganizeLoginRequired({ flag: '', search: '?exigir_login=1' }), { required: true, stored: '1' });
  assert.deepEqual(resolveOrganizeLoginRequired({ flag: '', stored: '1' }), { required: true, stored: '1' });
  assert.deepEqual(resolveOrganizeLoginRequired({ flag: '', search: '?exigir_login=0', stored: '1' }), { required: false, stored: null });
});

test('aviso de texto salvo vale por 3 dias depois do clique', async () => {
  const { isPendingOrganizeValid } = await import(MODULO);
  const agora = Date.UTC(2026, 9, 14, 12);
  const dia = 24 * 60 * 60 * 1000;

  assert.equal(isPendingOrganizeValid(String(agora - dia), agora), true);
  assert.equal(isPendingOrganizeValid(String(agora - 3 * dia), agora), false);
  assert.equal(isPendingOrganizeValid(String(agora + dia), agora), false);
  assert.equal(isPendingOrganizeValid(null, agora), false);
  assert.equal(isPendingOrganizeValid('abc', agora), false);
});

test('celular só é pedido a quem está logado, com perfil carregado e sem número', async () => {
  const { shouldAskForPhone } = await import(MODULO);

  assert.equal(shouldAskForPhone({ userId: 'u1', profile: { phone: null } }), true);
  assert.equal(shouldAskForPhone({ userId: 'u1', profile: { phone: '11987654321' } }), false);
  assert.equal(shouldAskForPhone({ userId: null, profile: { phone: null } }), false);
  // perfil ainda carregando: não trava o organizar esperando
  assert.equal(shouldAskForPhone({ userId: 'u1', profile: null }), false);
  // já adiou ou salvou nesta visita
  assert.equal(shouldAskForPhone({ userId: 'u1', profile: { phone: null }, suppressed: true }), false);
});

test('dá para adiar o celular duas vezes; assinante e afiliado sempre podem adiar', async () => {
  const { canSkipPhonePrompt, PHONE_PROMPT_MAX_SKIPS } = await import(MODULO);

  assert.equal(PHONE_PROMPT_MAX_SKIPS, 2);
  assert.equal(canSkipPhonePrompt({ skipCount: 0 }), true);
  assert.equal(canSkipPhonePrompt({ skipCount: 1 }), true);
  assert.equal(canSkipPhonePrompt({ skipCount: 2 }), false);
  assert.equal(canSkipPhonePrompt({ skipCount: 5, accessState: { isPaidProAccess: true } }), true);
  assert.equal(canSkipPhonePrompt({ skipCount: 5, accessState: { isAffiliate: true } }), true);
  assert.equal(canSkipPhonePrompt({ skipCount: 5, accessState: { isTrialAccess: true } }), false);
});
