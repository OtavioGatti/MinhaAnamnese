// `price` espelha o valor canônico de backend/config/billingPlans.js e serve
// apenas para exibição (ex.: preço com desconto de indicação). A cobrança real
// é sempre calculada no backend.
export const BILLING_PLANS = {
  monthly: {
    key: 'monthly',
    label: 'Mensal',
    title: 'Plano mensal',
    price: 24.9,
    priceCopy: 'R$ 24,90',
    periodCopy: 'por mês',
    daysCopy: '30 dias',
    description: 'Recorrente, para manter o acesso sem lembrar de pagar todo mês.',
    badge: 'Recorrente',
  },
  semiannual: {
    key: 'semiannual',
    label: 'Semestral',
    title: 'Plano semestral',
    price: 129.9,
    priceCopy: 'R$ 129,90',
    periodCopy: '6 meses',
    daysCopy: '180 dias',
    description: 'Pagamento único com melhor custo para continuar usando por mais tempo.',
    badge: 'Recomendado · Melhor custo',
    savingsCopy: 'Economize R$ 19,50',
  },
};

export const DEFAULT_PLAN_KEY = 'monthly';
export const PRO_PLAN_PRICE_COPY = BILLING_PLANS.monthly.priceCopy;
export const PRO_PLAN_PERIOD_COPY = BILLING_PLANS.monthly.periodCopy;
