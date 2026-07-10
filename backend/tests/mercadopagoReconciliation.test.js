const assert = require('node:assert/strict');
const test = require('node:test');
const { pickMostRecentAuthorizedPayment } = require('../apiHandlers/webhook/mercadopago');

function authorizedPayment(paymentId, dateCreated) {
  return { payment: { id: paymentId }, date_created: dateCreated };
}

test('retorna null para lista vazia', () => {
  assert.equal(pickMostRecentAuthorizedPayment([]), null);
  assert.equal(pickMostRecentAuthorizedPayment(undefined), null);
});

test('ignora itens sem payment id resolvível', () => {
  const result = pickMostRecentAuthorizedPayment([
    { date_created: '2026-01-01T00:00:00Z' },
    { payment: {}, date_created: '2026-01-02T00:00:00Z' },
  ]);

  assert.equal(result, null);
});

test('escolhe o pagamento mais recente por date_created', () => {
  const oldest = authorizedPayment('111', '2026-01-01T00:00:00Z');
  const middle = authorizedPayment('222', '2026-02-01T00:00:00Z');
  const newest = authorizedPayment('333', '2026-03-01T00:00:00Z');

  const result = pickMostRecentAuthorizedPayment([oldest, newest, middle]);

  assert.equal(result.payment.id, '333');
});

test('aceita payment_id direto (formato alternativo da API)', () => {
  const result = pickMostRecentAuthorizedPayment([
    { payment_id: '999', date_created: '2026-01-01T00:00:00Z' },
  ]);

  assert.equal(result.payment_id, '999');
});
