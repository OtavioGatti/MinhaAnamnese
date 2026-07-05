import { BILLING_PLANS } from '../billingPlans';

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

// Exibição do desconto de indicação; o valor cobrado é sempre recalculado no
// backend a partir do afiliado registrado.
function getDiscountedPriceCopy(plan, discountRate) {
  const rate = Number(discountRate) || 0;

  if (rate <= 0 || !Number.isFinite(Number(plan?.price))) {
    return null;
  }

  return formatCurrencyBRL(Math.round(plan.price * (1 - rate) * 100) / 100);
}

function PlanOptionCard({ plan, featured, loading, discountRate, onConfirm }) {
  const discountedPriceCopy = getDiscountedPriceCopy(plan, discountRate);

  return (
    <section className={`plan-comparison-column ${featured ? 'featured' : ''}`}>
      <div className="plan-comparison-featured-top">
        <div className="plan-comparison-title-stack">
          <span className={`plan-comparison-badge ${featured ? 'pro' : 'basic'}`}>{plan.badge}</span>
          <h3>{plan.title}</h3>
        </div>
        <div className="plan-comparison-price">
          {discountedPriceCopy ? (
            <>
              <s className="plan-comparison-price-original">{plan.priceCopy}</s>
              <strong>{discountedPriceCopy}</strong>
            </>
          ) : (
            <strong>{plan.priceCopy}</strong>
          )}
          <span>{plan.periodCopy}</span>
        </div>
      </div>
      <p>{plan.description}</p>
      {plan.savingsCopy ? <span className="plan-comparison-saving">{plan.savingsCopy}</span> : null}
      <ul>
        <li>avaliação completa de anamneses</li>
        <li>cartas de encaminhamento com IA</li>
        <li>guias de prescrição e bulário clínico</li>
        <li>templates próprios para sua rotina</li>
      </ul>
      <button type="button" className="btn btn-primario" onClick={() => onConfirm(plan.key)} disabled={loading}>
        {loading ? 'Abrindo checkout...' : `Escolher ${plan.label}`}
      </button>
    </section>
  );
}

function PlanComparisonModal({
  open,
  loading,
  loadingPlanKey,
  plans = BILLING_PLANS,
  isTrialAccess,
  referralDiscount = null,
  onClose,
  onConfirm,
}) {
  if (!open) {
    return null;
  }

  const monthlyPlan = plans.monthly;
  const semiannualPlan = plans.semiannual;
  const discountRate = Number(referralDiscount?.rate) || 0;
  const discountPercent = Math.round(discountRate * 100);

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card plan-comparison-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-comparison-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <div>
            <span className="workspace-kicker">Planos</span>
            <h2 id="plan-comparison-title">
              {isTrialAccess ? 'Mantenha o Plano Profissional depois do teste' : 'Escolha seu Plano Profissional'}
            </h2>
            <p>
              {isTrialAccess
                ? 'O pagamento preserva os dias restantes do teste e soma o período do plano escolhido.'
                : 'Mensal recorrente para não lembrar de pagar todo mês, ou semestral com melhor custo.'}
            </p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-scroll-region">
          {discountPercent > 0 ? (
            <div className="plan-comparison-discount-banner">
              Indicação{referralDiscount?.label ? ` ${referralDiscount.label}` : ''}: {discountPercent}% de desconto
              aplicado automaticamente no checkout.
            </div>
          ) : null}

          <div className="plan-comparison-grid">
            <section className="plan-comparison-column basic-summary">
              <span className="plan-comparison-badge basic">Plano básico</span>
              <h3>Para organizar rapidamente</h3>
              <ul>
                <li>organiza a anamnese em formato clínico</li>
                <li>mantém modelos oficiais no fluxo principal</li>
                <li>preserva seus dados e preferências básicas</li>
                <li>ideal para uso pontual sem recursos Pro</li>
              </ul>
            </section>

            <PlanOptionCard
              plan={monthlyPlan}
              featured={false}
              loading={loading && loadingPlanKey === monthlyPlan.key}
              discountRate={discountRate}
              onConfirm={onConfirm}
            />

            <PlanOptionCard
              plan={semiannualPlan}
              featured
              loading={loading && loadingPlanKey === semiannualPlan.key}
              discountRate={discountRate}
              onConfirm={onConfirm}
            />
          </div>

          <div className="plan-comparison-highlight">
            O teste profissional libera avaliações completas, encaminhamentos, prescrições, bulário e templates próprios por 7 dias.
          </div>

        </div>

        <div className="app-modal-actions plan-comparison-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Ainda não
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanComparisonModal;
