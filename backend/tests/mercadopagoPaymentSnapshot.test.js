const assert = require('node:assert/strict');
const test = require('node:test');
const webhook = require('../apiHandlers/webhook/mercadopago');
const { getBillingPlan } = require('../config/billingPlans');

const CONTA = '11111111-1111-4111-8111-111111111111';
const AFILIADO = { id: 'af-1', code: 'matheusmacari', commission_rate: 0.3 };
const ASSINATURA = { preapproval_id: 'pre-1', user_id: CONTA, amount: 22.41 };
const MENSAL = getBillingPlan('monthly');

function pagamento(extra = {}) {
  return { id: 178860426500, status: 'approved', transaction_amount: 22.41, currency_id: 'BRL', ...extra };
}

// --- linha gravada em billing_payments ---------------------------------------

// Caso real de 13/09/2026: cartão de indicado do Matheus recusado pelo banco.
test('pagamento recusado mantém o afiliado, mas não grava comissão', () => {
  const linha = webhook.buildPaymentSnapshot(pagamento({ status: 'rejected' }), CONTA, MENSAL, ASSINATURA, AFILIADO);

  assert.equal(linha.affiliateCode, 'matheusmacari', 'a tentativa continua atribuída');
  assert.equal(linha.commissionAmount, null, 'recusado não tem comissão');
  assert.equal(linha.amount, 22.41);
});

test('pagamento aprovado grava a comissão', () => {
  const linha = webhook.buildPaymentSnapshot(pagamento(), CONTA, MENSAL, ASSINATURA, AFILIADO);

  assert.equal(linha.commissionAmount, 6.72);
});

test('estorno grava a comissão, que é o valor a cancelar', () => {
  const linha = webhook.buildPaymentSnapshot(pagamento({ status: 'refunded' }), CONTA, MENSAL, ASSINATURA, AFILIADO);

  assert.equal(linha.commissionAmount, 6.72);
});

test('valor zero é gravado como zero, e valor que não veio fica vazio', () => {
  assert.equal(webhook.buildPaymentSnapshot(pagamento({ transaction_amount: 0 }), null).amount, 0);
  assert.equal(webhook.buildPaymentSnapshot(pagamento({ transaction_amount: undefined }), null).amount, null);
});

// --- aprovado sem vínculo ---------------------------------------------------

test('aprovado sem valor e sem assinatura é sinalizado (o caso de 13/09)', () => {
  const sinal = webhook.describeUnlinkedApprovedPayment({
    payment: { id: 178860193178, status: 'approved', currency_id: 'BRL' },
    plan: null,
    userId: null,
    subscription: null,
    approvedPlanPayment: false,
  });

  assert.deepEqual(sinal, {
    paymentId: '178860193178',
    status: 'approved',
    amount: null,
    viaAssinatura: false,
    motivo: 'plano_nao_identificado',
  });
});

test('aprovado com plano mas sem conta é sinalizado', () => {
  const sinal = webhook.describeUnlinkedApprovedPayment({
    payment: pagamento(),
    plan: MENSAL,
    userId: null,
    subscription: null,
    approvedPlanPayment: true,
  });

  assert.equal(sinal.motivo, 'conta_nao_identificada');
});

test('aprovado com valor fora do esperado é sinalizado', () => {
  const sinal = webhook.describeUnlinkedApprovedPayment({
    payment: pagamento({ transaction_amount: 19.99 }),
    plan: MENSAL,
    userId: CONTA,
    subscription: ASSINATURA,
    approvedPlanPayment: false,
  });

  assert.equal(sinal.motivo, 'valor_moeda_produto_ou_data_inesperados');
  assert.equal(sinal.viaAssinatura, true);
});

test('aprovado normal e recusado não são sinalizados', () => {
  assert.equal(webhook.describeUnlinkedApprovedPayment({
    payment: pagamento(), plan: MENSAL, userId: CONTA, subscription: ASSINATURA, approvedPlanPayment: true,
  }), null);

  assert.equal(webhook.describeUnlinkedApprovedPayment({
    payment: pagamento({ status: 'rejected' }), plan: null, userId: null, subscription: null, approvedPlanPayment: false,
  }), null);
});

test('o sinal de log não leva e-mail nem conta', () => {
  const sinal = webhook.describeUnlinkedApprovedPayment({
    payment: pagamento({ payer: { email: 'pessoa@exemplo.com' }, metadata: { email: 'pessoa@exemplo.com' } }),
    plan: MENSAL,
    userId: null,
    subscription: { preapproval_id: 'pre-1', payer_email: 'pessoa@exemplo.com' },
    approvedPlanPayment: true,
  });

  assert.deepEqual(Object.keys(sinal).sort(), ['amount', 'motivo', 'paymentId', 'status', 'viaAssinatura']);
  assert.equal(JSON.stringify(sinal).includes('@'), false);
});

test('o motivo do resultado do Mercado Pago vai para a linha gravada', () => {
  const recusado = webhook.buildPaymentSnapshot(
    pagamento({ status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' }),
    CONTA,
  );

  assert.equal(recusado.statusDetail, 'cc_rejected_insufficient_amount');
  assert.equal(webhook.buildPaymentSnapshot(pagamento(), CONTA).statusDetail, null);
});
