function InsightBlock({
  insightsSectionRef,
  insightPrincipalSection,
  shouldShowPaywall,
  performanceMessage,
  relevantGapsCount,
  onUpgradeInsights,
  loadingCheckout,
  checkoutError,
}) {
  const gapsLabel = `${relevantGapsCount} ${relevantGapsCount === 1 ? 'lacuna relevante' : 'lacunas relevantes'}`;

  return (
    <div ref={insightsSectionRef} className="card section-insight insight-block">
      <div className="card-header insight-block-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <div>
          <h2>{'A\u00e7\u00e3o recomendada'}</h2>
          <p className="card-subtitle">
            {'Traduza a leitura cl\u00ednica em um pr\u00f3ximo passo claro para a pr\u00f3xima coleta.'}
          </p>
        </div>
      </div>

      <div className="insight-highlight">
        <div className="insight-kicker">{'Pr\u00f3ximo passo'}</div>
        <p className="insight-primary-text">{insightPrincipalSection}</p>
      </div>

      {shouldShowPaywall && (
        <div className="paywall-panel insight-paywall-panel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="8" r="1" />
          </svg>

          <div className="insight-paywall-content">
            {performanceMessage ? (
              <div className="insight-performance-copy">{performanceMessage}</div>
            ) : null}

            <div className="insight-gap-copy">
              {'Voc\u00ea ainda tem '}<strong>{gapsLabel}</strong>{' nesta anamnese.'}
            </div>

            <div className="insight-paywall-label">
              {'\u{1F512} Ver todas as melhorias detalhadas'}
            </div>

            <button
              className="btn btn-secundario insight-paywall-button"
              type="button"
              onClick={onUpgradeInsights}
              disabled={loadingCheckout}
            >
              {loadingCheckout ? 'Redirecionando para o pagamento...' : 'Desbloquear por R$9,90'}
            </button>

            {checkoutError ? (
              <div className="feedback-secondary-error">
                {checkoutError}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightBlock;
