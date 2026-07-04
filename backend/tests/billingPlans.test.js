const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateCommissionAmount,
  getBillingPlan,
  getBillingPlanByAmount,
  getBillingPlanByProduct,
  isExpectedPlanAmount,
  normalizePlanKey,
} = require('../config/billingPlans');

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
  assert.equal(getBillingPlanByAmount(18.9)?.key, 'monthly');
  assert.equal(getBillingPlanByAmount(99.9)?.key, 'semiannual');
  assert.equal(getBillingPlanByAmount(9.9)?.key, 'legacy_monthly_v1');
  assert.equal(getBillingPlanByAmount(18.9, 'subscription')?.key, 'monthly');
  assert.equal(getBillingPlanByAmount(99.9, 'subscription'), null);
  assert.equal(getBillingPlanByAmount(123.45), null);
  assert.equal(getBillingPlanByAmount('não numérico'), null);
});

test('valida o valor esperado do plano com tolerância mínima', () => {
  const monthly = getBillingPlan('monthly');

  assert.equal(isExpectedPlanAmount(monthly, 18.9), true);
  assert.equal(isExpectedPlanAmount(monthly, 18.91), false);
  assert.equal(isExpectedPlanAmount(monthly, null), false);
  assert.equal(isExpectedPlanAmount(null, 18.9), false);
});

test('comissão de afiliado arredonda para 2 casas decimais', () => {
  assert.equal(calculateCommissionAmount(99.9, 0.3), 29.97);
  assert.equal(calculateCommissionAmount(18.9), 5.67);
  assert.equal(calculateCommissionAmount('abc'), null);
  assert.equal(calculateCommissionAmount(10, 'abc'), null);
});
