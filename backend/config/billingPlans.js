const PLAN_CURRENCY = 'BRL';
const COMMISSION_RATE = 0.3;

const BILLING_PLANS = {
  monthly: {
    key: 'monthly',
    title: 'Plano Profissional Mensal',
    reason: 'Minha Anamnese - Plano Profissional Mensal',
    product: 'professional_plan_monthly',
    billingKind: 'subscription',
    price: 18.9,
    days: 30,
    currencyId: PLAN_CURRENCY,
  },
  semiannual: {
    key: 'semiannual',
    title: 'Plano Profissional Semestral',
    reason: 'Minha Anamnese - Plano Profissional Semestral',
    product: 'professional_plan_semiannual',
    billingKind: 'one_time',
    price: 99.9,
    days: 180,
    currencyId: PLAN_CURRENCY,
  },
};

const LEGACY_BILLING_PLANS = {
  legacy_monthly_v1: {
    key: 'legacy_monthly_v1',
    title: 'Plano Profissional',
    reason: 'Minha Anamnese - Plano Profissional',
    product: 'professional_plan',
    billingKind: 'one_time',
    price: 9.9,
    days: 30,
    currencyId: PLAN_CURRENCY,
    legacy: true,
  },
};

const DEFAULT_PLAN_KEY = 'monthly';

function normalizePlanKey(value) {
  const candidate = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(BILLING_PLANS, candidate)
    ? candidate
    : DEFAULT_PLAN_KEY;
}

function getBillingPlan(planKey) {
  return BILLING_PLANS[normalizePlanKey(planKey)];
}

function getBillingPlanByProduct(product) {
  const normalizedProduct = String(product || '').trim();
  return [...Object.values(BILLING_PLANS), ...Object.values(LEGACY_BILLING_PLANS)].find(
    (plan) => plan.product === normalizedProduct,
  ) || null;
}

function getBillingPlanByAmount(amount, billingKind = null) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  return [...Object.values(BILLING_PLANS), ...Object.values(LEGACY_BILLING_PLANS)].find((plan) => {
    if (billingKind && plan.billingKind !== billingKind) {
      return false;
    }

    return Math.abs(numericAmount - plan.price) < 0.0001;
  }) || null;
}

function isExpectedPlanAmount(plan, amount) {
  const numericAmount = Number(amount);
  return Boolean(plan) && Number.isFinite(numericAmount) && Math.abs(numericAmount - plan.price) < 0.0001;
}

function calculateCommissionAmount(amount, rate = COMMISSION_RATE) {
  const numericAmount = Number(amount);
  const numericRate = Number(rate);

  if (!Number.isFinite(numericAmount) || !Number.isFinite(numericRate)) {
    return null;
  }

  return Math.round(numericAmount * numericRate * 100) / 100;
}

module.exports = {
  BILLING_PLANS,
  COMMISSION_RATE,
  DEFAULT_PLAN_KEY,
  LEGACY_BILLING_PLANS,
  PLAN_CURRENCY,
  calculateCommissionAmount,
  getBillingPlan,
  getBillingPlanByAmount,
  getBillingPlanByProduct,
  isExpectedPlanAmount,
  normalizePlanKey,
};
