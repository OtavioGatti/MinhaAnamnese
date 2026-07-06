const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_AFFILIATE_DISCOUNT_RATE,
  getBillingPlan,
  getDiscountedPlanAmount,
  getExpectedChargeAmounts,
  isExpectedChargedAmount,
  normalizeDiscountRate,
  roundCurrency,
} = require('../config/billingPlans');

test('normalizeDiscountRate ignora valores inválidos e aplica o teto', () => {
  assert.equal(normalizeDiscountRate(0.1), 0.1);
  assert.equal(normalizeDiscountRate(0), 0);
  assert.equal(normalizeDiscountRate(-0.2), 0);
  assert.equal(normalizeDiscountRate('abc'), 0);
  assert.equal(normalizeDiscountRate(null), 0);
  assert.equal(normalizeDiscountRate(0.9), MAX_AFFILIATE_DISCOUNT_RATE);
});

test('roundCurrency arredonda para 2 casas e rejeita não numéricos', () => {
  assert.equal(roundCurrency(17.009999999999998), 17.01);
  assert.equal(roundCurrency(89.91000000000001), 89.91);
  assert.equal(roundCurrency('abc'), null);
  assert.equal(roundCurrency(null), null);
});

test('getDiscountedPlanAmount calcula o preço com desconto arredondado', () => {
  const monthly = getBillingPlan('monthly');
  const semiannual = getBillingPlan('semiannual');

  assert.equal(getDiscountedPlanAmount(monthly, 0.1), 22.41);
  assert.equal(getDiscountedPlanAmount(semiannual, 0.1), 116.91);
  assert.equal(getDiscountedPlanAmount(monthly, 0), monthly.price);
  assert.equal(getDiscountedPlanAmount(monthly, null), monthly.price);
  assert.equal(getDiscountedPlanAmount(null, 0.1), null);
  // Acima do teto é tratado como o teto (50%).
  assert.equal(getDiscountedPlanAmount(semiannual, 0.9), 64.95);
});

test('getExpectedChargeAmounts reúne preço cheio, descontos e assinatura sem duplicar', () => {
  const semiannual = getBillingPlan('semiannual');

  assert.deepEqual(getExpectedChargeAmounts(semiannual), [129.9]);
  assert.deepEqual(
    getExpectedChargeAmounts(semiannual, { affiliateDiscountRate: 0.1 }).sort((a, b) => a - b),
    [116.91, 129.9],
  );
  assert.deepEqual(
    getExpectedChargeAmounts(semiannual, { affiliateDiscountRate: 0.1, metadataDiscountRate: 0.1 }).sort((a, b) => a - b),
    [116.91, 129.9],
  );
  assert.deepEqual(getExpectedChargeAmounts(null, { affiliateDiscountRate: 0.1 }), []);
});

test('isExpectedChargedAmount aceita preço cheio e com desconto de afiliado', () => {
  const monthly = getBillingPlan('monthly');
  const semiannual = getBillingPlan('semiannual');

  // Sem desconto: apenas o preço cheio.
  assert.equal(isExpectedChargedAmount(monthly, 24.9), true);
  assert.equal(isExpectedChargedAmount(monthly, 22.41), false);

  // Com taxa do afiliado (registro no banco).
  assert.equal(isExpectedChargedAmount(monthly, 22.41, { affiliateDiscountRate: 0.1 }), true);
  assert.equal(isExpectedChargedAmount(semiannual, 116.91, { affiliateDiscountRate: 0.1 }), true);

  // Com taxa da metadata criada pelo nosso checkout.
  assert.equal(isExpectedChargedAmount(semiannual, 116.91, { metadataDiscountRate: 0.1 }), true);

  // Valor da assinatura persistida server-side (protege renovações se a taxa mudar).
  assert.equal(isExpectedChargedAmount(monthly, 22.41, { subscriptionAmount: 22.41 }), true);

  // Reajuste de preço (18,90 -> 24,90): assinantes com o valor antigo persistido
  // em billing_subscriptions.amount continuam validando, mesmo com o preço do
  // plano atual mudado — é esse mecanismo que torna o reajuste seguro sem
  // precisar de uma entrada em LEGACY_BILLING_PLANS.
  assert.equal(isExpectedChargedAmount(monthly, 18.9, { subscriptionAmount: 18.9 }), true);
  assert.equal(isExpectedChargedAmount(monthly, 18.9), false);

  // Valores arbitrários continuam rejeitados.
  assert.equal(isExpectedChargedAmount(monthly, 15, { affiliateDiscountRate: 0.1 }), false);
  assert.equal(isExpectedChargedAmount(monthly, 0.01, { affiliateDiscountRate: 0.1 }), false);
  assert.equal(isExpectedChargedAmount(monthly, null, { affiliateDiscountRate: 0.1 }), false);
});
