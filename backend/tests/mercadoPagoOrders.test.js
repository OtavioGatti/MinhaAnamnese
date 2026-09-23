const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

// Token no formato do Mercado Pago: o número da aplicação é o segundo trecho.
process.env.MERCADO_PAGO_ORDERS_ACCESS_TOKEN = 'APP_USR-6088065196949330-092314-abc123-3341712080';

const orders = require('../services/mercadoPagoOrders');
const webhook = require('../apiHandlers/webhook/mercadopago');
const { describeDeclineReason } = require('../utils/paymentDeclineReasons');
const { getBillingPlan } = require('../config/billingPlans');

const CONTA = '11111111-1111-4111-8111-111111111111';
const SEMESTRAL = getBillingPlan('semiannual');

// --- aplicação -----------------------------------------------------------------

test('o número da aplicação sai do próprio token', () => {
  assert.equal(orders.getOrdersApplicationId(), '6088065196949330');
  assert.equal(orders.getOrdersApplicationId('lixo'), null);
  assert.equal(orders.isOrdersConfigured(), true);
});

// --- dados do formulário -------------------------------------------------------

test('Pix passa só com o método; o documento é opcional', () => {
  assert.deepEqual(orders.normalizeOrderPaymentInput({ paymentMethodId: 'pix' }), { kind: 'pix', paymentMethodId: 'pix', identification: null });
  assert.deepEqual(
    orders.normalizeOrderPaymentInput({ paymentMethodId: 'pix', identification: { type: 'cpf', number: '123.456.789-09' } }).identification,
    { type: 'CPF', number: '12345678909' },
  );
});

test('cartão de crédito exige token e é à vista; débito fica de fora', () => {
  const token = 'aeaa08c0d3ea869cd1e9997b1262fb20';
  const ok = orders.normalizeOrderPaymentInput({ paymentMethodId: 'visa', paymentTypeId: 'credit_card', token, installments: 1 });
  assert.equal(ok.kind, 'cartao');
  assert.equal(ok.installments, 1);

  // Sandbox, 23/09/2026: 3x em R$ 129,90 voltou 400 "invalid_transaction_amount".
  assert.equal(orders.normalizeOrderPaymentInput({ paymentMethodId: 'visa', paymentTypeId: 'credit_card', token, installments: 3 }), null);

  assert.equal(orders.normalizeOrderPaymentInput({ paymentMethodId: 'visa', paymentTypeId: 'debit_card', token, installments: 1 }), null);
  assert.equal(orders.normalizeOrderPaymentInput({ paymentMethodId: 'visa', paymentTypeId: 'credit_card', token: 'x', installments: 1 }), null);
  assert.equal(orders.normalizeOrderPaymentInput({ paymentMethodId: 'visa', paymentTypeId: 'credit_card', token, installments: 13 }), null);
  assert.equal(orders.normalizeOrderPaymentInput(null), null);
});

// --- pedido enviado ------------------------------------------------------------

test('o pedido leva valor do servidor, a conta no external_reference e nada de metadata', () => {
  const pix = orders.buildOrderPayload({ userId: CONTA, email: 'a@b.com', plan: SEMESTRAL, chargeAmount: 116.91, input: { kind: 'pix', identification: null } });

  assert.equal(pix.total_amount, '116.91');
  assert.equal(pix.external_reference, CONTA);
  assert.equal('metadata' in pix, false, 'a Orders API recusa metadata (400)');
  assert.equal('notification_url' in pix, false);
  assert.deepEqual(pix.transactions.payments[0], { amount: '116.91', payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: 'PT30M' });

  const cartao = orders.buildOrderPayload({
    userId: CONTA,
    email: 'a@b.com',
    plan: SEMESTRAL,
    chargeAmount: 129.9,
    input: { kind: 'cartao', paymentMethodId: 'visa', token: 'tok12345', installments: 2, identification: { type: 'CPF', number: '12345678909' } },
  });
  assert.equal(cartao.total_amount, '129.90');
  assert.deepEqual(cartao.transactions.payments[0].payment_method, { id: 'visa', type: 'credit_card', token: 'tok12345', installments: 2 });
  assert.deepEqual(cartao.payer.identification, { type: 'CPF', number: '12345678909' });
});

// --- resposta do Mercado Pago (formatos reais do sandbox, 23/09/2026) -----------

const PEDIDO_APROVADO = {
  id: 'ORDTST01M37SYPWC0BQ8ADGK31CW6PKM',
  status: 'processed',
  status_detail: 'accredited',
  integration_data: { application_id: '6088065196949330' },
  external_reference: CONTA,
  transactions: {
    payments: [{ id: 'PAY01M37SYPWX0258TTVC8E8SB7JD', status: 'processed', status_detail: 'accredited', payment_method: { id: 'visa', type: 'credit_card' } }],
  },
};

const PEDIDO_PIX = {
  id: 'ORDTST01M37SZ97W0RPPT93BHPRNMWHB',
  status: 'action_required',
  status_detail: 'waiting_transfer',
  transactions: {
    payments: [{
      id: 'PAY01M37SZ989AZDF5V06HC64CTQE',
      status: 'action_required',
      date_of_expiration: '2026-09-23T19:25:41.402+00:00',
      payment_method: {
        id: 'pix',
        ticket_url: 'https://www.mercadopago.com.br/sandbox/payments/179532948059/ticket',
        qr_code: '00020126580014br.gov.bcb.pix01',
        qr_code_base64: 'iVBORw0KGgo=',
      },
    }],
  },
};

const RECUSA_402 = {
  errors: [{ code: 'failed', message: 'The following transactions failed', details: ['PAY01M37T6ST11WNX2TZCV7FHE8Y5: insufficient_amount'] }],
  data: {
    id: 'ORDTST01M37T6SSHHYB2149KMN9E0BZE',
    status: 'failed',
    status_detail: 'failed',
    transactions: { payments: [{ id: 'PAY01M37T6ST11WNX2TZCV7FHE8Y5', status: 'failed', status_detail: 'insufficient_amount' }] },
  },
};

test('cartão aprovado: libera o Pro na hora', () => {
  const resposta = orders.describeOrderResponse(PEDIDO_APROVADO, { describeDecline: describeDeclineReason });
  assert.equal(resposta.processar, true);
  assert.deepEqual(resposta.body.data, { status: 'approved', order_id: PEDIDO_APROVADO.id });
});

test('Pix: devolve QR Code, copia e cola e validade, sem liberar nada ainda', () => {
  const resposta = orders.describeOrderResponse(PEDIDO_PIX);
  assert.equal(resposta.processar, false);
  assert.equal(resposta.body.data.status, 'pending');
  assert.equal(resposta.body.data.order_id, PEDIDO_PIX.id);
  assert.equal(resposta.body.data.pix.qr_code, '00020126580014br.gov.bcb.pix01');
  assert.equal(resposta.body.data.pix.expires_at, '2026-09-23T19:25:41.402+00:00');
});

test('recusa (402): o motivo do banco vira orientação para quem pagou', () => {
  const resposta = orders.describeOrderResponse(RECUSA_402, { describeDecline: describeDeclineReason });
  assert.equal(resposta.statusCode, 422);
  assert.equal(resposta.body.code, 'CARD_DECLINED');
  assert.equal(resposta.body.detalhe, 'insufficient_amount');
  assert.match(resposta.body.error, /limite/i);
});

test('o motivo do pedido ganha o prefixo que o tradutor de motivos conhece', () => {
  assert.equal(orders.normalizeOrderDeclineDetail('insufficient_amount'), 'cc_rejected_insufficient_amount');
  assert.equal(orders.normalizeOrderDeclineDetail('cc_rejected_other_reason'), 'cc_rejected_other_reason');
  assert.equal(orders.normalizeOrderDeclineDetail(''), null);
});

test('status inesperado não promete que nada foi cobrado', () => {
  const resposta = orders.describeOrderResponse({ id: 'ORDX', status: 'estranho' });
  assert.equal(resposta.statusCode, 502);
  assert.match(resposta.body.error, /liberado automaticamente/);
});

// --- pagamento por baixo do pedido ----------------------------------------------

test('acha o pagamento do pedido pela referência ORDER_MP', () => {
  const resultados = [
    { id: 1, point_of_interaction: { references: [{ id: 'ORDOUTRO', type: 'ORDER_MP' }] } },
    { id: 179532948059, point_of_interaction: { references: [{ id: PEDIDO_PIX.id, type: 'ORDER_MP' }] } },
  ];
  assert.equal(orders.pickPaymentForOrder(resultados, PEDIDO_PIX.id), '179532948059');
  assert.equal(orders.pickPaymentForOrder(resultados, 'ORDNENHUM'), null);
  assert.equal(orders.getOrderReference(resultados[1]), PEDIDO_PIX.id);
  assert.equal(orders.getOrderReference({ point_of_interaction: { type: 'CHECKOUT' } }), null);
});

test('o metadata reconstruído é o do semestral, com o afiliado da conta', () => {
  const metadata = orders.buildOrderMetadata({ order: PEDIDO_APROVADO, affiliate: { id: 'af-1', code: 'matheusmacari', discount_rate: 0.1 } });

  assert.equal(metadata.user_id, CONTA);
  assert.equal(metadata.plan_key, 'semiannual');
  assert.equal(metadata.product, SEMESTRAL.product);
  assert.equal(metadata.affiliate_code, 'matheusmacari');
  assert.equal(metadata.discount_rate, 0.1);
  assert.equal(metadata.checkout_na_pagina, true, 'e-mail de recusa não sai: a pessoa já viu na tela');
});

test('pedido de outra aplicação ou sem conta válida não vira semestral', () => {
  assert.equal(orders.buildOrderMetadata({ order: { ...PEDIDO_APROVADO, integration_data: { application_id: '999' } } }), null);
  assert.equal(orders.buildOrderMetadata({ order: { ...PEDIDO_APROVADO, external_reference: 'sandbox-123' } }), null);
  assert.equal(orders.buildOrderMetadata({ order: null }), null);
});

// Caso real do sandbox (23/09/2026, pagamento 180529076552): sem a
// reconstrução o webhook descartava a venda e a pessoa pagava sem receber o Pro.
test('pagamento do pedido com o metadata reconstruído é reconhecido como venda do semestral', () => {
  const pagamento = {
    id: 180529076552,
    status: 'approved',
    status_detail: 'accredited',
    date_approved: '2026-09-23T19:20:00.000-04:00',
    transaction_amount: 129.9,
    currency_id: 'BRL',
    external_reference: CONTA,
    metadata: {},
    point_of_interaction: { type: 'CHECKOUT', references: [{ id: PEDIDO_APROVADO.id, type: 'ORDER_MP' }] },
  };
  const descartado = webhook.isApprovedPlanPayment(pagamento, webhook.resolvePlanForPayment(pagamento, null), null, {});
  assert.equal(descartado, false, 'sem metadata, o webhook não reconhece');

  const reconstruido = { ...pagamento, metadata: orders.buildOrderMetadata({ order: PEDIDO_APROVADO }) };
  const plano = webhook.resolvePlanForPayment(reconstruido, null);

  assert.equal(plano.key, 'semiannual');
  assert.equal(webhook.getPaymentUserId(reconstruido, null), CONTA);
  assert.equal(webhook.isApprovedPlanPayment(reconstruido, plano, null, { affiliateDiscountRate: 0, metadataDiscountRate: 0 }), true);
});

test('com desconto de afiliado, o valor com desconto também é reconhecido', () => {
  const afiliado = { id: 'af-1', code: 'matheusmacari', discount_rate: 0.1 };
  const pagamento = {
    status: 'approved',
    date_approved: '2026-09-23T19:20:00.000-04:00',
    transaction_amount: 116.91,
    currency_id: 'BRL',
    metadata: orders.buildOrderMetadata({ order: PEDIDO_APROVADO, affiliate: afiliado }),
  };
  const plano = webhook.resolvePlanForPayment(pagamento, null);

  assert.equal(webhook.isApprovedPlanPayment(pagamento, plano, null, { affiliateDiscountRate: 0.1, metadataDiscountRate: 0.1 }), true);
});

// --- webhook -------------------------------------------------------------------

test('aviso "order" vai para o pedido; "merchant_order" do Checkout Pro não', () => {
  const req = (body) => ({ body, query: {} });
  assert.equal(webhook.isOrderWebhook(req({ type: 'order', action: 'order.processed' })), true);
  assert.equal(webhook.isOrderWebhook(req({ action: 'order.processed' })), true);
  assert.equal(webhook.isOrderWebhook(req({ topic: 'merchant_order' })), false);
  assert.equal(webhook.isOrderWebhook(req({ type: 'payment' })), false);
});

test('a assinatura do aviso vale com o segredo de qualquer uma das duas aplicações', () => {
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'segredo-principal';
  process.env.MERCADO_PAGO_ORDERS_WEBHOOK_SECRET = 'segredo-semestral';
  const assinar = (segredo, id) => crypto.createHmac('sha256', segredo).update(`id:${id};request-id:req-1;ts:1700;`).digest('hex');
  const req = (v1) => ({ headers: { 'x-signature': `ts=1700,v1=${v1}`, 'x-request-id': 'req-1' } });

  assert.equal(webhook.isMercadoPagoWebhookSignatureValid(req(assinar('segredo-principal', '179532948059')), '179532948059').valid, true);
  assert.equal(webhook.isMercadoPagoWebhookSignatureValid(req(assinar('segredo-semestral', '179532948059')), '179532948059').valid, true);
  // Id alfanumérico do pedido é assinado em minúsculas.
  assert.equal(webhook.isMercadoPagoWebhookSignatureValid(req(assinar('segredo-semestral', 'ordtst01abc')), 'ORDTST01ABC').valid, true);
  assert.equal(webhook.isMercadoPagoWebhookSignatureValid(req(assinar('outro-segredo', '1')), '1').valid, false);

  delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  delete process.env.MERCADO_PAGO_ORDERS_WEBHOOK_SECRET;
});
