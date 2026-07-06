const assert = require('node:assert/strict');
const test = require('node:test');
const {
  BILLING_PLANS,
  calculateCommissionAmount,
  getBillingPlan,
  getBillingPlanByAmount,
  getBillingPlanByProduct,
  isExpectedPlanAmount,
  normalizePlanKey,
} = require('../config/billingPlans');

// Mercado Pago rejeita a criação de preapproval (assinatura) com
// reason acima de 40 caracteres (erro: "reason has more than 40 characters").
// Este teste evita que o bug volte a passar despercebido.
test('reason de planos de assinatura respeita o limite de 40 caracteres do Mercado Pago', () => {
  const subscriptionPlans = Object.values(BILLING_PLANS).filter(
    (plan) => plan.billingKind === 'subscription',
  );

  assert.ok(subscriptionPlans.length > 0, 'deveria existir ao menos um plano de assinatura');

  for (const plan of subscriptionPlans) {
    assert.ok(
      plan.reason.length <= 40,
      `reason do plano "${plan.key}" tem ${plan.reason.length} caracteres (máximo 40): "${plan.reason}"`,
    );
  }
});

test('normalizePlanKey usa o plano padrão para valores desconhecidos', () => {
  assert.equal(normalizePlanKey('monthly'), 'monthly');
  assert.equal(normalizePlanKey('SEMIANNUAL'), 'semiannual');
  assert.equal(normalizePlanKey('plano_invalido'), 'monthly');
  assert.equal(normalizePlanKey(null), 'monthly');
});

test('resolve plano por produto, inclusive legado', () => {
  assert.equal(getBillingPlanByProduct('professional_plan_monthly')?.key, 'monthly');
  assert.equal(getBillingPlanByProduct('professional_plan_semiannual')?.key, 'semiannual');
  assert.equal(getBillingPlanByProduct('professional_plan')?.key, 'legacy_monthly_v1');
  assert.equal(getBillingPlanByProduct('produto_desconhecido'), null);
});

test('resolve plano por valor com filtro de tipo de cobrança', () => {
  assert.equal(getBillingPlanByAmount(24.9)?.key, 'monthly');
  assert.equal(getBillingPlanByAmount(129.9)?.key, 'semiannual');
  assert.equal(getBillingPlanByAmount(9.9)?.key, 'legacy_monthly_v1');
  assert.equal(getBillingPlanByAmount(24.9, 'subscription')?.key, 'monthly');
  assert.equal(getBillingPlanByAmount(129.9, 'subscription'), null);
  assert.equal(getBillingPlanByAmount(123.45), null);
  assert.equal(getBillingPlanByAmount('não numérico'), null);
});

test('valida o valor esperado do plano com tolerância mínima', () => {
  const monthly = getBillingPlan('monthly');

  assert.equal(isExpectedPlanAmount(monthly, 24.9), true);
  assert.equal(isExpectedPlanAmount(monthly, 24.91), false);
  assert.equal(isExpectedPlanAmount(monthly, null), false);
  assert.equal(isExpectedPlanAmount(null, 24.9), false);
});

test('comissão de afiliado arredonda para 2 casas decimais', () => {
  assert.equal(calculateCommissionAmount(129.9, 0.3), 38.97);
  assert.equal(calculateCommissionAmount(24.9), 7.47);
  assert.equal(calculateCommissionAmount('abc'), null);
  assert.equal(calculateCommissionAmount(10, 'abc'), null);
});
