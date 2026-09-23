const assert = require('node:assert/strict');
const test = require('node:test');

// Sem banco: o limitador cai para a memória e a consulta de assinatura ativa
// falha — é assim que dá para testar as travas sem rede.
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.CARD_CHECKOUT_ENABLED;

const {
  describeCardSubscriptionFailure,
  isCardCheckoutEnabled,
  normalizeCardToken,
} = require('../services/cardCheckout');
const checkout = require('../apiHandlers/create-checkout');
const webhook = require('../apiHandlers/webhook/mercadopago');
const { getBillingPlan } = require('../config/billingPlans');

const MENSAL = getBillingPlan('monthly');
const SEMESTRAL = getBillingPlan('semiannual');
const REQ = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };

function contaNova() {
  return `11111111-1111-4111-8111-${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}`;
}

// --- chave de desligar -------------------------------------------------------

test('o pagamento com cartão nasce desligado e só liga com CARD_CHECKOUT_ENABLED=true', () => {
  assert.equal(isCardCheckoutEnabled(), false);

  process.env.CARD_CHECKOUT_ENABLED = 'sim';
  assert.equal(isCardCheckoutEnabled(), false, 'só o valor exato liga');

  process.env.CARD_CHECKOUT_ENABLED = 'true';
  assert.equal(isCardCheckoutEnabled(), true);

  delete process.env.CARD_CHECKOUT_ENABLED;
});

// --- token do cartão ---------------------------------------------------------

test('o token do cartão só passa se tiver o formato de token', () => {
  assert.equal(normalizeCardToken(' 4ec0286e1b2c3d4e5f60718293a4b5c6 '), '4ec0286e1b2c3d4e5f60718293a4b5c6');
  assert.equal(normalizeCardToken(''), null);
  assert.equal(normalizeCardToken(null), null);
  assert.equal(normalizeCardToken(4235647728025682), null, 'número de cartão cru nunca vale como token');
  assert.equal(normalizeCardToken('abc'), null);
  assert.equal(normalizeCardToken('token com espaço'), null);
  assert.equal(normalizeCardToken('x'.repeat(200)), null);
});

// --- o que vai para o Mercado Pago -------------------------------------------

test('sem cartão, a assinatura segue como hoje: pending e sem token', () => {
  const payload = checkout.buildSubscriptionPayload({
    baseUrl: 'https://app.test', webhookUrl: 'https://api.test/webhook', email: 'a@b.com', userId: 'u1', plan: MENSAL, chargeAmount: 24.9,
  });

  assert.equal(payload.status, 'pending');
  assert.equal('card_token_id' in payload, false);
  assert.equal(payload.auto_recurring.transaction_amount, 24.9);
});

test('com cartão, a assinatura nasce authorized com o token — mesma recorrência', () => {
  const payload = checkout.buildSubscriptionPayload({
    baseUrl: 'https://app.test', webhookUrl: 'https://api.test/webhook', email: 'a@b.com', userId: 'u1', plan: MENSAL, chargeAmount: 17.43, cardTokenId: 'tok123abc456',
  });

  assert.equal(payload.status, 'authorized');
  assert.equal(payload.card_token_id, 'tok123abc456');
  assert.equal(payload.notification_url, 'https://api.test/webhook', 'sem aviso o Pro nunca é liberado');
  assert.deepEqual(payload.auto_recurring, {
    frequency: 1, frequency_type: 'months', transaction_amount: 17.43, currency_id: 'BRL',
  });
  assert.equal(payload.external_reference, 'u1');
});

// --- recusa do Mercado Pago --------------------------------------------------

// Respostas reais do sandbox em 23/09/2026.
test('cartão que não aceita recorrência vira mensagem para trocar de cartão', () => {
  const falha = describeCardSubscriptionFailure({
    providerStatus: 400, providerMessage: 'Unsupported_credit_card_for_recurring_payment', providerCode: 'Invalid_payment_method',
  });

  assert.equal(falha.statusCode, 422);
  assert.equal(falha.code, 'CARD_NOT_RECURRING');
  assert.match(falha.error, /cartão de crédito/);
});

test('recusa na validação do cartão e token expirado têm mensagens próprias', () => {
  assert.equal(describeCardSubscriptionFailure({ providerStatus: 400, providerMessage: 'CC_VAL_433 Credit card validation has failed' }).code, 'CARD_DECLINED');
  assert.equal(describeCardSubscriptionFailure({ providerStatus: 400, providerMessage: 'Card token service not found' }).code, 'CARD_TOKEN_INVALID');
});

test('recusa sem motivo conhecido pede para conferir o cartão, sem inventar causa', () => {
  const falha = describeCardSubscriptionFailure({ providerStatus: 400, providerMessage: 'User bad request' });

  assert.equal(falha.statusCode, 422);
  assert.equal(falha.code, 'CARD_NOT_ACCEPTED');
});

test('instabilidade do Mercado Pago avisa que nada foi cobrado', () => {
  for (const providerStatus of [500, 503, undefined]) {
    const falha = describeCardSubscriptionFailure({ providerStatus });
    assert.equal(falha.statusCode, 502);
    assert.match(falha.error, /Nenhuma cobrança foi feita/);
  }
});

// --- travas antes de chamar o Mercado Pago -----------------------------------

test('desligado no servidor, recusa com código para o frontend voltar ao checkout antigo', async () => {
  const recusa = await checkout.checkCardCheckoutRequest({ req: REQ, userId: contaNova(), plan: MENSAL, cardTokenId: 'tok123abc456' });

  assert.equal(recusa.statusCode, 503);
  assert.equal(recusa.body.code, 'CARD_CHECKOUT_DISABLED');
});

test('o semestral não passa pelo cartão na página (continua com Pix no Mercado Pago)', async () => {
  process.env.CARD_CHECKOUT_ENABLED = 'true';
  const recusa = await checkout.checkCardCheckoutRequest({ req: REQ, userId: contaNova(), plan: SEMESTRAL, cardTokenId: 'tok123abc456' });
  delete process.env.CARD_CHECKOUT_ENABLED;

  assert.equal(recusa.statusCode, 400);
});

test('sem token válido nem chega ao Mercado Pago', async () => {
  process.env.CARD_CHECKOUT_ENABLED = 'true';
  const recusa = await checkout.checkCardCheckoutRequest({ req: REQ, userId: contaNova(), plan: MENSAL, cardTokenId: null });
  delete process.env.CARD_CHECKOUT_ENABLED;

  assert.equal(recusa.body.code, 'CARD_TOKEN_INVALID');
});

// A assinatura com cartão já nasce cobrando: na dúvida sobre existir outra,
// recusa. Aqui a consulta falha porque não há banco.
test('sem conseguir consultar a assinatura ativa, recusa em vez de arriscar cobrança dobrada', async () => {
  process.env.CARD_CHECKOUT_ENABLED = 'true';
  const recusa = await checkout.checkCardCheckoutRequest({ req: REQ, userId: contaNova(), plan: MENSAL, cardTokenId: 'tok123abc456' });
  delete process.env.CARD_CHECKOUT_ENABLED;

  assert.equal(recusa.statusCode, 503);
});

test('clique duplo: a segunda tentativa em seguida é barrada antes do Mercado Pago', async () => {
  process.env.CARD_CHECKOUT_ENABLED = 'true';
  const conta = contaNova();
  const req = { headers: {}, socket: { remoteAddress: '10.0.0.7' } };

  const primeira = await checkout.checkCardCheckoutRequest({ req, userId: conta, plan: MENSAL, cardTokenId: 'tok123abc456' });
  const segunda = await checkout.checkCardCheckoutRequest({ req, userId: conta, plan: MENSAL, cardTokenId: 'tok789def012' });
  delete process.env.CARD_CHECKOUT_ENABLED;

  assert.notEqual(primeira.statusCode, 429, 'a primeira passa pelos limites');
  assert.equal(segunda.statusCode, 429);
  assert.ok(segunda.retryAfterSeconds > 0);
});

// --- estorno da validação do cartão no webhook -------------------------------

const ASSINATURA = { preapproval_id: 'pre-1', amount: 24.9 };

test('a devolução da cobrança de validação não é tratada como estorno da assinatura', () => {
  assert.equal(webhook.isCardValidationRefund({
    existingPayment: null,
    payment: { status: 'refunded', transaction_amount: 1 },
    subscription: ASSINATURA,
    preapprovalId: 'pre-1',
  }), true);
});

test('estorno de mensalidade que liberou acesso continua cancelando a assinatura', () => {
  assert.equal(webhook.isCardValidationRefund({
    existingPayment: { status: 'approved', processed_at: '2026-09-20T10:00:00Z' },
    payment: { status: 'refunded', transaction_amount: 24.9 },
    subscription: ASSINATURA,
    preapprovalId: 'pre-1',
  }), false);
});

test('estorno do valor da mensalidade cujo aprovado não chegou também cancela', () => {
  assert.equal(webhook.isCardValidationRefund({
    existingPayment: null,
    payment: { status: 'charged_back', transaction_amount: 24.9 },
    subscription: ASSINATURA,
    preapprovalId: 'pre-1',
  }), false);
});

test('sem assinatura envolvida (semestral) ou sem valor conhecido, o estorno segue como sempre', () => {
  assert.equal(webhook.isCardValidationRefund({
    existingPayment: null, payment: { status: 'refunded', transaction_amount: 1 }, subscription: null, preapprovalId: null,
  }), false);
  assert.equal(webhook.isCardValidationRefund({
    existingPayment: null, payment: { status: 'refunded', transaction_amount: 1 }, subscription: { preapproval_id: 'pre-1' }, preapprovalId: 'pre-1',
  }), false);
});

// --- cobrança da assinatura ligada à assinatura ------------------------------

// Formato real da cobrança de assinatura no sandbox (23/09/2026): metadata
// vazia, a assinatura só aparece em point_of_interaction.
test('a cobrança da assinatura é reconhecida pelo subscription_id do Mercado Pago', () => {
  const cobranca = {
    id: 180454579026,
    status: 'approved',
    metadata: {},
    point_of_interaction: {
      type: 'SUBSCRIPTIONS',
      transaction_data: { subscription_id: 'f12bd0711c2f494b94149d4e5927205a', invoice_id: 'inv-1' },
    },
  };

  assert.equal(webhook.getPaymentPreapprovalId(cobranca), 'f12bd0711c2f494b94149d4e5927205a');
});

test('pagamento avulso (semestral) continua sem assinatura', () => {
  assert.equal(webhook.getPaymentPreapprovalId({ id: 1, metadata: { plan_key: 'semiannual' }, point_of_interaction: { type: 'CHECKOUT' } }), null);
});

test('o vínculo explícito continua valendo antes do point_of_interaction', () => {
  assert.equal(webhook.getPaymentPreapprovalId({
    preapproval_id: 'pre-explicito',
    point_of_interaction: { transaction_data: { subscription_id: 'outro' } },
  }), 'pre-explicito');
});

// Caso real de 23/09/2026: um cartão voltou como "dados do cartão expiraram"
// sem que desse para saber o que o Mercado Pago disse. O detalhe vai para o log
// e para o evento do painel.
test('a resposta original do Mercado Pago sai curta e só com caracteres comuns', () => {
  assert.equal(
    checkout.describeProviderDetail({ providerCode: 'Invalid_payment_method', providerMessage: 'Unsupported_credit_card_for_recurring_payment' }),
    'Invalid_payment_method: Unsupported_credit_card_for_recurring_payment',
  );
  assert.equal(checkout.describeProviderDetail({ providerMessage: '<script>x</script> card_token "inválido"' }), 'scriptx/script card_token invlido');
  assert.equal(checkout.describeProviderDetail({ providerMessage: 'x'.repeat(300) }).length, 100);
  assert.equal(checkout.describeProviderDetail({}), null);
});
