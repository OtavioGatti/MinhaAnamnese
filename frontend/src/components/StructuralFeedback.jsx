function getStructureLabel(score) {
  if (score >= 85) {
    return 'Boa';
  }

  if (score >= 70) {
    return 'Adequada';
  }

  if (score >= 55) {
    return 'Parcial';
  }

  return 'Insuficiente';
}

function StructuralFeedback({
  qualityScore,
  animatedScore,
  primaryGapsCopy,
  secondaryGaps,
  insightError,
  hasFinalInterpretation,
  improvementBoxCopy,
  improvementButtonLabel,
  onMelhorarAnamnese,
  onPaywallAction,
  paywallTitle,
  paywallDescription,
  paywallButtonLabel,
  checkoutError,
  canImprove,
  loadingCheckout,
  loadingInsights,
  showAnalyzeAction,
  onGerarInsights,
}) {
  const structureLabel = qualityScore.shouldShowScore
    ? `Estrutura: ${getStructureLabel(qualityScore.score)} (${qualityScore.score})`
    : '';
  const showTeaser = !qualityScore.shouldShowScore && !loadingInsights;

  return (
    <div className="card reveal-block reveal-block-delayed section-feedback workspace-panel">
      <div className="card-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18" />
          <path d="M7 8h10" />
          <path d="M7 16h6" />
        </svg>
        <div>
          <h2>Como elevar a qualidade da sua anamnese</h2>
          <p className="card-subtitle">
            Entenda onde a estrutura perdeu força, o impacto disso na leitura clínica e qual ajuste mais melhora a próxima coleta.
          </p>
        </div>
      </div>

      <div className="feedback-stack">
        {qualityScore.shouldShowScore ? (
          <>
            <div className="score-feedback-header">
              <div className="score-feedback-copy">
                <div className="score-feedback-label">{structureLabel}</div>
                <div className="score-feedback-message" title={qualityScore.message}>
                  {qualityScore.message}
                </div>
              </div>
            </div>

            <div className="score-progress-track">
              <div
                style={{
                  width: `${animatedScore}%`,
                  background: qualityScore.score >= 75
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : qualityScore.score >= 55
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : 'linear-gradient(90deg, #f97316, #ef4444)',
                  transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                className="score-progress-bar"
              />
            </div>

            {primaryGapsCopy ? (
              <div className="secondary-support-card">
                <div className="feedback-highlight-block">
                  <strong>O que mais enfraqueceu esta anamnese</strong>
                  <span>{primaryGapsCopy}</span>
                </div>

                {Array.isArray(secondaryGaps) && secondaryGaps.length > 0 ? (
                  <div className="feedback-secondary-list">
                    <strong>Outras lacunas relevantes</strong>
                    <ul>
                      {secondaryGaps.slice(0, 3).map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!hasFinalInterpretation && (
              <div className="feedback-action-panel">
                <strong className="feedback-panel-title">Próximo movimento recomendado</strong>
                <span>{improvementBoxCopy}</span>
                <div className="feedback-action-row">
                  <button
                    className="btn btn-secundario"
                    type="button"
                    onClick={onMelhorarAnamnese}
                    disabled={!canImprove}
                  >
                    {improvementButtonLabel}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : showTeaser ? (
          <div className="feedback-placeholder feedback-placeholder-highlight">
            <strong>{paywallTitle}</strong>
            <span>{paywallDescription}</span>
            <div className="feedback-action-row">
              <button
                className="btn btn-secundario"
                type="button"
                onClick={onPaywallAction}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? 'Abrindo checkout...' : paywallButtonLabel}
              </button>
            </div>
            {checkoutError ? <div className="feedback-secondary-error">{checkoutError}</div> : null}
          </div>
        ) : (
          <div className="feedback-placeholder">
            <strong>{loadingInsights ? 'Gerando leitura estrutural' : 'Análise ainda indisponível'}</strong>
            <span>
              {loadingInsights
                ? 'Estamos preparando a nota, a principal lacuna e o ajuste com maior impacto para a próxima coleta.'
                : qualityScore.message || 'Gere a análise para ver onde a estrutura enfraqueceu e o que vale corrigir primeiro.'}
            </span>
          </div>
        )}

        {showAnalyzeAction && !showTeaser && (
          <>
            {insightError ? <div className="feedback-secondary-error">{insightError}</div> : null}
            <div className="feedback-action-row">
              <button
                className="btn btn-secundario"
                type="button"
                onClick={onGerarInsights}
                disabled={loadingInsights}
              >
                {loadingInsights ? 'Gerando análise...' : paywallButtonLabel}
              </button>
            </div>
            <span className="feedback-helper-copy">
              Veja a leitura estrutural completa e receba uma orientação mais clara para a próxima coleta.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default StructuralFeedback;
