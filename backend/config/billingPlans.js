const PLAN_CURRENCY = 'BRL';
const COMMISSION_RATE = 0.3;
const MAX_AFFILIATE_DISCOUNT_RATE = 0.5;
const AMOUNT_EPSILON = 0.0001;

const BILLING_PLANS = {
  monthly: {
    key: 'monthly',
    title: 'Plano Profissional Mensal',
    // Mercado Pago rejeita preapproval (assinatura) com "reason" acima de 40 caracteres.
    reason: 'Minha Anamnese - Profissional Mensal',
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
  return Boolean(plan) && Number.isFinite(numericAmount) && Math.abs(numericAmount - plan.price) < AMOUNT_EPSILON;
}

function roundCurrency(value) {
  if (value == null || value === '') {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.round(numericValue * 100) / 100;
}

function normalizeDiscountRate(value) {
  const numericRate = Number(value);

  if (!Number.isFinite(numericRate) || numericRate <= 0) {
    return 0;
  }

  return Math.min(numericRate, MAX_AFFILIATE_DISCOUNT_RATE);
}

// Único ponto de arredondamento do preço com desconto: checkout e webhook
// PRECISAM usar esta função para o valor cobrado e o valor esperado baterem.
function getDiscountedPlanAmount(plan, discountRate) {
  if (!plan || !Number.isFinite(Number(plan.price))) {
    return null;
  }

  const normalizedRate = normalizeDiscountRate(discountRate);

  if (normalizedRate === 0) {
    return plan.price;
  }

  return roundCurrency(plan.price * (1 - normalizedRate));
}

// Valores aceitos para um pagamento do plano: preço cheio, preço com desconto
// (taxa atual do afiliado e/ou taxa registrada na metadata criada pelo nosso
// checkout) e o valor persistido da assinatura (gravado server-side na criação).
function getExpectedChargeAmounts(plan, { affiliateDiscountRate = 0, metadataDiscountRate = 0, subscriptionAmount = null } = {}) {
  if (!plan) {
    return [];
  }

  const amounts = new Set([plan.price]);

  for (const rate of [affiliateDiscountRate, metadataDiscountRate]) {
    const discounted = getDiscountedPlanAmount(plan, rate);

    if (discounted != null) {
      amounts.add(discounted);
    }
  }

  const normalizedSubscriptionAmount = roundCurrency(subscriptionAmount);

  if (normalizedSubscriptionAmount != null && normalizedSubscriptionAmount > 0) {
    amounts.add(normalizedSubscriptionAmount);
  }

  return [...amounts];
}

function isExpectedChargedAmount(plan, amount, discountContext = {}) {
  const numericAmount = Number(amount);

  if (!plan || !Number.isFinite(numericAmount)) {
    return false;
  }

  return getExpectedChargeAmounts(plan, discountContext).some(
    (expected) => Math.abs(numericAmount - expected) < AMOUNT_EPSILON,
  );
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
  MAX_AFFILIATE_DISCOUNT_RATE,
  PLAN_CURRENCY,
  calculateCommissionAmount,
  getBillingPlan,
  getBillingPlanByAmount,
  getBillingPlanByProduct,
  getDiscountedPlanAmount,
  getExpectedChargeAmounts,
  isExpectedChargedAmount,
  isExpectedPlanAmount,
  normalizeDiscountRate,
  roundCurrency,
  normalizePlanKey,
};
