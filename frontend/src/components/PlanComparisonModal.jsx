import { useState } from 'react';
import { BILLING_PLANS } from '../billingPlans';
import { DIAGNOSTIC_HYPOTHESES_ENABLED } from '../config';
import { LETTER_TYPES } from '../letterTypes';
import { buildProFeatureList, estimatePerMonthPrice, summarizeTrialUsage } from '../lib/proOffer';

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

// Condições de cada plano; o que o Profissional inclui fica numa lista só,
// abaixo dos dois cartões, em vez de repetida em cada um.
const PLAN_TERMS = {
  monthly: ['Cobrança automática no cartão, todo mês', 'Cancele quando quiser, pelo seu perfil'],
  semiannual: ['Pagamento único no cartão ou Pix', 'Sem renovação automática'],
};

const PLAN_MONTHS = {
  semiannual: 6,
};

function PlanOptionCard({ plan, featured, loading, discountRate, onConfirm }) {
  const discountedPriceCopy = getDiscountedPriceCopy(plan, discountRate);
  const perMonth = PLAN_MONTHS[plan.key]
    ? estimatePerMonthPrice(plan.price, PLAN_MONTHS[plan.key], discountRate)
    : null;

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
          {perMonth ? <span>equivale a {formatCurrencyBRL(perMonth)}/mês</span> : null}
        </div>
      </div>
      <p>{plan.description}</p>
      {plan.savingsCopy ? <span className="plan-comparison-saving">{plan.savingsCopy}</span> : null}
      <ul>
        {(PLAN_TERMS[plan.key] || []).map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ul>
      <button type="button" className="btn btn-primario" onClick={() => onConfirm(plan.key)} disabled={loading}>
        {loading ? 'Abrindo checkout...' : `Escolher ${plan.label}`}
      </button>
    </section>
  );
}

// O que a pessoa já usou no teste: é o argumento mais concreto que existe para
// ela assinar — "isso aqui para se você não assinar".
function TrialUsageSummary({ items, isTrialExpired }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="plan-comparison-usage" aria-label="Seu uso no teste">
      <span className="plan-comparison-usage-kicker">
        {isTrialExpired ? 'No seu teste você usou' : 'No seu teste até agora'}
      </span>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <strong>{item.count}</strong>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <p>
        {isTrialExpired
          ? 'Tudo isso volta assim que você assinar.'
          : 'Assinando agora, nada disso para quando o teste acabar.'}
      </p>
    </section>
  );
}

function ProFeatureList({ catalog }) {
  const features = buildProFeatureList({
    catalog,
    letterTypeCount: LETTER_TYPES.length,
    hypothesesEnabled: DIAGNOSTIC_HYPOTHESES_ENABLED,
  });

  return (
    <section className="plan-comparison-features" aria-labelledby="plan-comparison-features-title">
      <h3 id="plan-comparison-features-title">Tudo o que o Profissional inclui</h3>
      <ul>
        {features.map((feature) => (
          <li key={feature.key}>
            <strong>{feature.title}</strong>
            <span>{feature.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Código de indicação digitado. O TikTok exige este caminho: link em legenda
// não é clicável, então quem vem de lá digita o endereço e chega sem ?ref.
//
// "locked" = a indicação já está salva na conta (write-once no servidor), e o
// checkout vai usá-la de qualquer jeito — não faz sentido oferecer troca.
function ReferralCodeSection({ referralDiscount, locked, onApply }) {
  const [editando, setEditando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const aplicado = Boolean(referralDiscount?.code);
  const percentual = Math.round((Number(referralDiscount?.rate) || 0) * 100);

  if (aplicado && !editando) {
    return (
      <div className="plan-comparison-discount-banner">
        Código <strong>{referralDiscount.code}</strong>
        {percentual > 0 ? ` aplicado: ${percentual}% de desconto no checkout.` : ' aplicado.'}
        {!locked && onApply ? (
          <button
            type="button"
            className="plan-comparison-referral-change"
            onClick={() => {
              setEditando(true);
              setCodigo('');
              setErro('');
            }}
          >
            Usar outro código
          </button>
        ) : null}
      </div>
    );
  }

  if (!onApply) {
    return null;
  }

  const enviar = async (event) => {
    event.preventDefault();
    const valor = codigo.trim();

    if (!valor) {
      setErro('Digite o código de indicação.');
      return;
    }

    setAplicando(true);
    setErro('');
    const resultado = await onApply(valor);
    setAplicando(false);

    if (resultado?.ok) {
      setEditando(false);
      setCodigo('');
      return;
    }

    setErro(resultado?.error || 'Não foi possível aplicar o código.');
  };

  return (
    <form className="plan-comparison-referral-form" onSubmit={enviar}>
      <label htmlFor="plan-referral-code">Tem um código de indicação?</label>
      <div className="plan-comparison-referral-row">
        <input
          id="plan-referral-code"
          type="text"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          placeholder="Digite o código"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={48}
        />
        <button type="submit" className="btn btn-secundario" disabled={aplicando}>
          {aplicando ? 'Validando...' : 'Aplicar'}
        </button>
      </div>
      {erro ? <p className="plan-comparison-referral-error">{erro}</p> : null}
    </form>
  );
}

function PlanComparisonModal({
  open,
  loading,
  loadingPlanKey,
  plans = BILLING_PLANS,
  isTrialAccess,
  isTrialExpired = false,
  trialUsage = null,
  catalog = null,
  referralDiscount = null,
  referralLocked = false,
  onApplyReferralCode,
  checkoutError = '',
  onClose,
  onConfirm,
}) {
  if (!open) {
    return null;
  }

  const monthlyPlan = plans.monthly;
  const semiannualPlan = plans.semiannual;
  const discountRate = Number(referralDiscount?.rate) || 0;
  const usageItems = isTrialAccess || isTrialExpired ? summarizeTrialUsage(trialUsage?.used) : [];
  let title = 'Escolha seu Plano Profissional';
  let subtitle = 'Mensal recorrente para não lembrar de pagar todo mês, ou semestral com melhor custo.';

  if (isTrialAccess) {
    title = 'Mantenha o Plano Profissional depois do teste';
    subtitle = 'O pagamento preserva os dias restantes do teste e soma o período do plano escolhido.';
  } else if (isTrialExpired) {
    title = 'Seu teste terminou. Continue de onde parou';
    subtitle = 'Organizar anamneses continua liberado. O resto do Profissional volta assim que você assinar.';
  }

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
            <h2 id="plan-comparison-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-scroll-region">
          {checkoutError ? (
            <div className="templates-inline-error plan-comparison-error">{checkoutError}</div>
          ) : null}

          <ReferralCodeSection
            referralDiscount={referralDiscount}
            locked={referralLocked}
            onApply={onApplyReferralCode}
          />

          <TrialUsageSummary items={usageItems} isTrialExpired={isTrialExpired && !isTrialAccess} />

          <div className="plan-comparison-grid">
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

          <ProFeatureList catalog={catalog} />

          <p className="plan-comparison-basic-note">
            Sem assinar, você continua organizando anamneses nos modelos oficiais.
          </p>
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
