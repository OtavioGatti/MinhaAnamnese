const assert = require('node:assert/strict');
const test = require('node:test');
const webhook = require('../apiHandlers/webhook/mercadopago');

test('pagamento único é processado como pagamento (nem assinatura, nem autorizado)', () => {
  const req = { body: { type: 'payment' } };

  assert.equal(webhook.isAuthorizedPaymentWebhook(req), false);
  assert.equal(webhook.isSubscriptionWebhook(req), false);
});

test('preapproval é assinatura, não pagamento autorizado', () => {
  const req = { body: { type: 'subscription_preapproval' } };

  assert.equal(webhook.isSubscriptionWebhook(req), true);
  assert.equal(webhook.isAuthorizedPaymentWebhook(req), false);
});

test('subscription_authorized_payment é pagamento autorizado (não cai só como assinatura)', () => {
  const req = { body: { type: 'subscription_authorized_payment' } };

  // Contém "subscription", mas precisa ser tratado como pagamento para promover
  // o usuário; o roteamento checa authorized_payment primeiro.
  assert.equal(webhook.isAuthorizedPaymentWebhook(req), true);
  assert.equal(webhook.isSubscriptionWebhook(req), true);
});

test('classificação também funciona via query string (topic)', () => {
  assert.equal(
    webhook.isAuthorizedPaymentWebhook({ query: { topic: 'authorized_payment' } }),
    true,
  );
  assert.equal(
    webhook.isSubscriptionWebhook({ query: { topic: 'preapproval' } }),
    true,
  );
});
