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

test('reembolso e chargeback revogam; demais status não', () => {
  assert.equal(webhook.isRevokedPaymentStatus('refunded'), true);
  assert.equal(webhook.isRevokedPaymentStatus('charged_back'), true);
  assert.equal(webhook.isRevokedPaymentStatus('REFUNDED'), true);

  // 'cancelled' aqui é pagamento pendente abandonado (boleto/pix não pago):
  // nunca concedeu acesso, não revoga nada.
  assert.equal(webhook.isRevokedPaymentStatus('cancelled'), false);
  assert.equal(webhook.isRevokedPaymentStatus('approved'), false);
  assert.equal(webhook.isRevokedPaymentStatus('pending'), false);
  assert.equal(webhook.isRevokedPaymentStatus(null), false);
});
