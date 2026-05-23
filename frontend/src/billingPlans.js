export const BILLING_PLANS = {
  monthly: {
    key: 'monthly',
    label: 'Mensal',
    title: 'Plano mensal',
    priceCopy: 'R$ 18,90',
    periodCopy: 'por mês',
    daysCopy: '30 dias',
    description: 'Recorrente, para manter o acesso sem lembrar de pagar todo mês.',
    badge: 'Recorrente',
  },
  semiannual: {
    key: 'semiannual',
    label: 'Semestral',
    title: 'Plano semestral',
    priceCopy: 'R$ 99,90',
    periodCopy: '6 meses',
    daysCopy: '180 dias',
    description: 'Pagamento único com melhor custo para continuar usando por mais tempo.',
    badge: 'Melhor custo',
    savingsCopy: 'Economize R$ 13,50',
  },
};

export const DEFAULT_PLAN_KEY = 'monthly';
export const PRO_PLAN_PRICE_COPY = BILLING_PLANS.monthly.priceCopy;
export const PRO_PLAN_PERIOD_COPY = BILLING_PLANS.monthly.periodCopy;
