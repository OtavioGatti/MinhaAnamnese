const assert = require('node:assert/strict');
const test = require('node:test');
const { summarizeAffiliateCommissions } = require('../services/affiliates');

function commission(amount, status, payoutId = null) {
  return { commission_amount: amount, status, payout_id: payoutId };
}

test('comissão sem saque conta como disponível', () => {
  const summary = summarizeAffiliateCommissions([commission(38.97, 'approved')]);

  assert.equal(summary.availableCommission, 38.97);
  assert.equal(summary.processingCommission, 0);
  assert.equal(summary.pendingCommission, 38.97);
  assert.equal(summary.conversions, 1);
});

test('comissão em saque aberto (requested) conta como em processamento', () => {
  const payoutStatus = new Map([['p1', 'requested']]);
  const summary = summarizeAffiliateCommissions([commission(38.97, 'approved', 'p1')], payoutStatus);

  assert.equal(summary.processingCommission, 38.97);
  assert.equal(summary.availableCommission, 0);
});

test('comissão presa em saque rejeitado volta a ser disponível (auto-recuperação)', () => {
  const payoutStatus = new Map([['p1', 'rejected']]);
  const summary = summarizeAffiliateCommissions(
    [commission(38.97, 'approved', 'p1'), commission(38.97, 'approved', 'p1')],
    payoutStatus,
  );

  assert.equal(summary.availableCommission, 77.94);
  assert.equal(summary.processingCommission, 0);
});

test('comissão presa em saque marcado pago manualmente não volta a disponível (evita saque em dobro)', () => {
  const payoutStatus = new Map([['p1', 'paid']]);
  const summary = summarizeAffiliateCommissions([commission(38.97, 'approved', 'p1')], payoutStatus);

  assert.equal(summary.availableCommission, 0);
  assert.equal(summary.processingCommission, 0);
  // Ainda aparece como pendente (não foi baixada corretamente), mas não sacável.
  assert.equal(summary.pendingCommission, 38.97);
});

test('comissão paga entra em pago e não em disponível', () => {
  const summary = summarizeAffiliateCommissions([commission(38.97, 'paid', 'p1')]);

  assert.equal(summary.paidCommission, 38.97);
  assert.equal(summary.availableCommission, 0);
  assert.equal(summary.pendingCommission, 0);
});

test('comissão cancelada é ignorada nos saldos', () => {
  const summary = summarizeAffiliateCommissions([commission(38.97, 'cancelled')]);

  assert.equal(summary.availableCommission, 0);
  assert.equal(summary.pendingCommission, 0);
  assert.equal(summary.paidCommission, 0);
  assert.equal(summary.totalCommission, 38.97);
});

test('comissão dentro da carência de 7 dias fica em carência, não disponível', () => {
  const now = new Date('2026-07-13T00:00:00Z').getTime();
  const recent = new Date('2026-07-10T00:00:00Z').toISOString(); // 3 dias atrás
  const summary = summarizeAffiliateCommissions(
    [{ commission_amount: 40, status: 'approved', created_at: recent }],
    new Map(),
    { now },
  );

  assert.equal(summary.holdCommission, 40);
  assert.equal(summary.availableCommission, 0);
  assert.equal(summary.pendingCommission, 40);
});

test('comissão fora da carência (>7 dias) fica disponível', () => {
  const now = new Date('2026-07-13T00:00:00Z').getTime();
  const old = new Date('2026-07-01T00:00:00Z').toISOString(); // 12 dias atrás
  const summary = summarizeAffiliateCommissions(
    [{ commission_amount: 40, status: 'approved', created_at: old }],
    new Map(),
    { now },
  );

  assert.equal(summary.availableCommission, 40);
  assert.equal(summary.holdCommission, 0);
});

test('comissão sem created_at conta como disponível (compat com dados legados)', () => {
  const summary = summarizeAffiliateCommissions([{ commission_amount: 40, status: 'approved' }]);

  assert.equal(summary.availableCommission, 40);
  assert.equal(summary.holdCommission, 0);
});

test('somatório misto arredonda corretamente e separa cada saldo', () => {
  const payoutStatus = new Map([
    ['aberto', 'requested'],
    ['rejeitado', 'rejected'],
  ]);
  const summary = summarizeAffiliateCommissions(
    [
      commission(38.97, 'approved'), // disponível
      commission(38.97, 'approved', 'rejeitado'), // disponível (auto-recuperado)
      commission(38.97, 'approved', 'aberto'), // em processamento
      commission(38.97, 'paid', 'pago-antigo'), // pago
      commission(38.97, 'cancelled'), // ignorado
    ],
    payoutStatus,
  );

  assert.equal(summary.availableCommission, 77.94);
  assert.equal(summary.processingCommission, 38.97);
  assert.equal(summary.paidCommission, 38.97);
  assert.equal(summary.conversions, 5);
});
