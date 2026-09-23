const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { getBillingPlan, getDiscountedPlanAmount } = require('../config/billingPlans');

// Lógica pura do checkout com cartão do frontend (ESM), testada daqui porque o
// frontend não tem suíte própria.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'cardCheckout.js')).href;

// --- quando o checkout novo aparece ------------------------------------------

test('sem chave pública o checkout com cartão nunca aparece, nem com a flag ligada', async () => {
  const { resolveCardCheckoutEnabled } = await import(MODULO);

  assert.equal(resolveCardCheckoutEnabled({ flag: 'on', publicKey: '' }).enabled, false);
});

test('com a flag ligada vale para todos; desligada, fica como hoje', async () => {
  const { resolveCardCheckoutEnabled } = await import(MODULO);

  assert.equal(resolveCardCheckoutEnabled({ flag: 'on', publicKey: 'APP_USR-x' }).enabled, true);
  assert.equal(resolveCardCheckoutEnabled({ flag: '', publicKey: 'APP_USR-x' }).enabled, false);
});

// Teste em produção antes de abrir para todo mundo: só o navegador de quem
// abriu o link de teste vê o checkout novo.
test('?checkout_cartao=1 liga só neste navegador e ?checkout_cartao=0 desliga', async () => {
  const { resolveCardCheckoutEnabled } = await import(MODULO);

  const ligado = resolveCardCheckoutEnabled({ flag: '', publicKey: 'APP_USR-x', search: '?checkout_cartao=1' });
  assert.deepEqual(ligado, { enabled: true, stored: '1' });

  const depois = resolveCardCheckoutEnabled({ flag: '', publicKey: 'APP_USR-x', search: '', stored: '1' });
  assert.equal(depois.enabled, true, 'continua ligado nas próximas visitas');

  const desligado = resolveCardCheckoutEnabled({ flag: '', publicKey: 'APP_USR-x', search: '?checkout_cartao=0', stored: '1' });
  assert.deepEqual(desligado, { enabled: false, stored: null });
});

// --- o que fazer com a resposta ----------------------------------------------

test('assinatura criada vira "autorizada" com o id para confirmar a cobrança', async () => {
  const { describeCardCheckoutResult } = await import(MODULO);

  assert.deepEqual(
    describeCardCheckoutResult({ success: true, status: 200, data: { preapproval_id: 'pre-9', status: 'authorized' } }),
    { kind: 'autorizada', preapprovalId: 'pre-9' },
  );
});

test('servidor com o caminho novo desligado manda de volta ao checkout do Mercado Pago', async () => {
  const { describeCardCheckoutResult } = await import(MODULO);

  assert.equal(describeCardCheckoutResult({ success: false, status: 503, code: 'CARD_CHECKOUT_DISABLED' }).kind, 'checkout_antigo');
});

test('cartão recusado mostra a mensagem do servidor e deixa tentar de novo', async () => {
  const { describeCardCheckoutResult } = await import(MODULO);
  const desfecho = describeCardCheckoutResult({
    success: false, status: 422, code: 'CARD_NOT_RECURRING', error: 'Este cartão não aceita cobrança mensal automática. Use um cartão de crédito.',
  });

  assert.equal(desfecho.kind, 'recusada');
  assert.equal(desfecho.code, 'CARD_NOT_RECURRING');
  assert.match(desfecho.message, /cartão de crédito/);
});

test('quem já assina é avisado de que nada foi cobrado', async () => {
  const { describeCardCheckoutResult } = await import(MODULO);

  assert.equal(describeCardCheckoutResult({ success: false, status: 409, code: 'SUBSCRIPTION_ALREADY_ACTIVE', error: 'x' }).kind, 'ja_assina');
});

test('sem conexão, a mensagem garante que nada foi cobrado', async () => {
  const { describeCardCheckoutResult } = await import(MODULO);
  const desfecho = describeCardCheckoutResult({ success: false, status: 0 });

  assert.equal(desfecho.kind, 'erro');
  assert.match(desfecho.message, /Nenhuma cobrança foi feita/);
});

// --- valor mostrado ----------------------------------------------------------

// Mostrar um centavo diferente do cobrado é o tipo de coisa que faz a pessoa
// desconfiar do pagamento. Mesma conta do backend para todo desconto possível.
test('o valor mostrado no formulário é o mesmo que o servidor cobra', async () => {
  const { estimateMonthlyCharge } = await import(MODULO);
  const mensal = getBillingPlan('monthly');

  for (let pontos = 0; pontos <= 50; pontos += 1) {
    const taxa = pontos / 100;
    assert.equal(estimateMonthlyCharge(mensal.price, taxa), getDiscountedPlanAmount(mensal, taxa), `desconto de ${pontos}%`);
  }
});

// --- acesso liberado ---------------------------------------------------------

test('o Pro só conta como liberado quando o servidor diz que é pago (teste não conta)', async () => {
  const { isPaidAccessConfirmed } = await import(MODULO);

  assert.equal(isPaidAccessConfirmed({ access_state: { isPaidProAccess: true } }), true);
  assert.equal(isPaidAccessConfirmed({ access_state: { hasActiveProAccess: true, isTrialAccess: true, isPaidProAccess: false } }), false);
  assert.equal(isPaidAccessConfirmed(null), false);
});
