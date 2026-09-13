const assert = require('node:assert/strict');
const test = require('node:test');

// Sem banco e sem Resend: prova que nada sai para a rede.
delete process.env.RESEND_API_KEY;
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  isDiscountedAmount,
  isRenewalOfSubscription,
  isStaleRejection,
  notifyApprovedPayment,
  notifyRejectedPayment,
  notifySubscriptionCancelled,
  pickNextPaymentDate,
  wasRejectionRecentlyNotified,
} = require('../services/billingNotifications');
const { getBillingPlan } = require('../config/billingPlans');

const AGORA = new Date('2026-09-13T21:15:00Z');
const horasAtras = (n) => new Date(AGORA.getTime() - n * 3600000).toISOString();

// --- boas-vindas ou renovação ---------------------------------------------------

test('primeira cobrança da assinatura é boas-vindas, não renovação', () => {
  assert.equal(isRenewalOfSubscription({
    paymentId: 'p1',
    preapprovalId: 'pre-1',
    history: [{ payment_id: 'p1', preapproval_id: 'pre-1', status: 'approved', processed_at: horasAtras(0) }],
  }), false, 'o próprio pagamento não conta');
});

test('cobrança com outra aprovada na mesma assinatura é renovação', () => {
  assert.equal(isRenewalOfSubscription({
    paymentId: 'p2',
    preapprovalId: 'pre-1',
    history: [
      { payment_id: 'p2', preapproval_id: 'pre-1', status: 'approved', processed_at: horasAtras(0) },
      { payment_id: 'p1', preapproval_id: 'pre-1', status: 'approved', processed_at: horasAtras(720) },
    ],
  }), true);
});

test('quem volta a assinar depois de cancelar recebe boas-vindas de novo', () => {
  assert.equal(isRenewalOfSubscription({
    paymentId: 'p9',
    preapprovalId: 'pre-nova',
    history: [{ payment_id: 'p1', preapproval_id: 'pre-antiga', status: 'approved', processed_at: horasAtras(2000) }],
  }), false);
});

test('aprovado que não liberou acesso não transforma a próxima em renovação', () => {
  assert.equal(isRenewalOfSubscription({
    paymentId: 'p2',
    preapprovalId: 'pre-1',
    history: [{ payment_id: 'p1', preapproval_id: 'pre-1', status: 'approved', processed_at: null }],
  }), false);
});

// --- recusa: um e-mail, não um por tentativa ----------------------------------

test('primeira tentativa: outra recusa avisada há 2 h segura o e-mail, mesmo de outra assinatura', () => {
  assert.equal(wasRejectionRecentlyNotified({
    paymentId: 'p2',
    preapprovalId: 'pre-2',
    renewal: false,
    history: [{ payment_id: 'p1', preapproval_id: 'pre-1', status: 'rejected', notified_at: horasAtras(2) }],
    now: AGORA,
  }), true, 'cada clique em assinar cria uma assinatura nova');
});

test('primeira tentativa: recusa avisada há mais de 24 h libera novo e-mail', () => {
  assert.equal(wasRejectionRecentlyNotified({
    paymentId: 'p2',
    preapprovalId: 'pre-2',
    renewal: false,
    history: [{ payment_id: 'p1', preapproval_id: 'pre-1', status: 'rejected', notified_at: horasAtras(25) }],
    now: AGORA,
  }), false);
});

test('renovação: uma recusa avisada por mensalidade (10 dias), só da mesma assinatura', () => {
  const recusaAvisada = (horas, preapprovalId = 'pre-1') => ({
    payment_id: 'p-antigo', preapproval_id: preapprovalId, status: 'rejected', notified_at: horasAtras(horas),
  });
  const base = { paymentId: 'p-novo', preapprovalId: 'pre-1', renewal: true, now: AGORA };

  assert.equal(wasRejectionRecentlyNotified({ ...base, history: [recusaAvisada(5 * 24)] }), true, 'retentativa do Mercado Pago');
  assert.equal(wasRejectionRecentlyNotified({ ...base, history: [recusaAvisada(11 * 24)] }), false, 'mensalidade seguinte');
  assert.equal(wasRejectionRecentlyNotified({ ...base, history: [recusaAvisada(5 * 24, 'pre-outra')] }), false);
});

test('recusa não avisada não segura o próximo e-mail', () => {
  assert.equal(wasRejectionRecentlyNotified({
    paymentId: 'p2',
    preapprovalId: 'pre-1',
    renewal: false,
    history: [{ payment_id: 'p1', preapproval_id: 'pre-1', status: 'rejected', notified_at: null }],
    now: AGORA,
  }), false);
});

test('notificação atrasada de recusa antiga não vira e-mail', () => {
  assert.equal(isStaleRejection(horasAtras(4 * 24), AGORA), true);
  assert.equal(isStaleRejection(horasAtras(1), AGORA), false);
  assert.equal(isStaleRejection(null, AGORA), false);
});

// --- dados do e-mail ------------------------------------------------------------

test('próxima cobrança só aparece quando é futura', () => {
  assert.equal(pickNextPaymentDate(horasAtras(0), AGORA), null, 'data da cobrança que acabou de acontecer');
  assert.equal(pickNextPaymentDate('2026-10-13T21:11:53Z', AGORA), '2026-10-13T21:11:53.000Z');
  assert.equal(pickNextPaymentDate(null, AGORA), null);
});

test('desconto de indicação detectado pelo valor cobrado', () => {
  const mensal = getBillingPlan('monthly');

  assert.equal(isDiscountedAmount(22.41, mensal), true);
  assert.equal(isDiscountedAmount(24.9, mensal), false);
  assert.equal(isDiscountedAmount(null, mensal), false);
});

// --- sem configuração, nada sai -------------------------------------------------

test('sem Resend configurado, nenhum e-mail é tentado', async () => {
  const mensal = getBillingPlan('monthly');

  assert.equal((await notifyApprovedPayment({ paymentId: 'p1', userId: 'u', to: 'a@b.com', plan: mensal, amount: 24.9 })).sent, false);
  assert.equal((await notifyRejectedPayment({ paymentId: 'p1', userId: 'u', to: 'a@b.com', amount: 24.9 })).sent, false);
  assert.equal((await notifySubscriptionCancelled({ to: 'a@b.com' })).sent, false);
});
