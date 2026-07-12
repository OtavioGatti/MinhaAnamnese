import { parseCriticalInsight } from '../utils/criticalInsight';

const SECTION_ACTION_VERB = {
  missing: 'Documentar',
  partial: 'Detalhar',
};

// Roteiro concreto do que falta para completar a anamnese, montado a partir do
// status por seção que a análise já calculou (ausente/parcial) + a recomendação
// que o backend gera para cada uma. É o "como chegar lá", não só 1 ponto.
function buildCompletionRoadmap(sections) {
  if (!Array.isArray(sections)) {
    return [];
  }

  const priorityOrder = { missing: 0, partial: 1 };

  return sections
    .filter((section) => section.status === 'missing' || section.status === 'partial')
    .sort((left, right) => (priorityOrder[left.status] ?? 9) - (priorityOrder[right.status] ?? 9))
    .map((section) => ({
      id: section.id || section.label,
      label: section.label,
      status: section.status,
      verb: SECTION_ACTION_VERB[section.status] || 'Revisar',
      detail: section.recommendation || section.issue || '',
    }));
}

function InsightBlock({
  insightsSectionRef,
  insightPrincipalSection,
  sections = [],
  shouldShowPaywall,
  performanceMessage,
  relevantGapsCount,
  onPaywallAction,
  loadingCheckout,
  checkoutError,
  paywallTitle,
  paywallDescription,
  paywallButtonLabel,
  paywallHighlights = [],
}) {
  const gapsLabel = `${relevantGapsCount} ${relevantGapsCount === 1 ? 'lacuna relevante' : 'lacunas relevantes'}`;
  const structuredAction = parseCriticalInsight(insightPrincipalSection);
  const roadmap = buildCompletionRoadmap(sections);

  return (
    <div ref={insightsSectionRef} className="card section-insight insight-block">
      <div className="card-header insight-block-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <div>
          <h2>Ação recomendada</h2>
          <p className="card-subtitle">
            Traduza a leitura clínica em um próximo passo claro para a próxima coleta.
          </p>
        </div>
      </div>

      <div className="insight-highlight">
        <div className="insight-kicker">Próximo passo</div>
        <div className="insight-priority-card">
          <strong>{'Ajuste priorit\u00e1rio'}</strong>
          <span>{structuredAction.priority || insightPrincipalSection}</span>
        </div>

        {structuredAction.consequence || structuredAction.impact ? (
          <div className="insight-reason-grid">
            {structuredAction.consequence ? (
              <div className="insight-reason-card">
                <strong>Impacto na leitura</strong>
                <span>{structuredAction.consequence}</span>
              </div>
            ) : null}

            {structuredAction.impact ? (
              <div className="insight-reason-card">
                <strong>Impacto na qualidade</strong>
                <span>{structuredAction.impact}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {structuredAction.actionItems.length > 0 ? (
          <div className="insight-action-list">
            <strong>Na próxima coleta, inclua</strong>
            <ul>
              {structuredAction.actionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {!shouldShowPaywall && roadmap.length > 0 ? (
        <div className="insight-roadmap">
          <div className="insight-roadmap-header">
            <strong>Roteiro para completar esta anamnese</strong>
            <span>Cobrindo estes pontos, a estrutura fica completa para revisão.</span>
          </div>
          <ol className="insight-roadmap-list">
            {roadmap.map((step) => (
              <li key={step.id} className={`insight-roadmap-item insight-roadmap-${step.status}`}>
                <span className="insight-roadmap-tag">{step.status === 'missing' ? 'Ausente' : 'Parcial'}</span>
                <div>
                  <strong>{step.verb} {step.label}</strong>
                  {step.detail ? <span>{step.detail}</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {shouldShowPaywall && (
        <div className="paywall-panel insight-paywall-panel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="8" r="1" />
          </svg>

          <div className="insight-paywall-content">
            {performanceMessage ? <div className="insight-performance-copy">{performanceMessage}</div> : null}

            <div className="insight-gap-copy">
              Você ainda tem <strong>{gapsLabel}</strong> nesta anamnese.
            </div>

            <div className="insight-paywall-label">{paywallTitle}</div>
            <div className="feedback-helper-copy">{paywallDescription}</div>

            {paywallHighlights.length > 0 ? (
              <ul className="insight-paywall-list">
                {paywallHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            <button
              className="btn btn-secundario insight-paywall-button"
              type="button"
              onClick={onPaywallAction}
              disabled={loadingCheckout}
            >
              {loadingCheckout ? 'Redirecionando para o pagamento...' : paywallButtonLabel}
            </button>

            {checkoutError ? <div className="feedback-secondary-error">{checkoutError}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightBlock;
