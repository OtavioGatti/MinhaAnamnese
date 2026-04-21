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
  insightError,
  isProUser,
  hasFinalInterpretation,
  improvementBoxCopy,
  improvementButtonLabel,
  onMelhorarAnamnese,
  onUpgradeInsights,
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
  const showFreeTeaser = !isProUser && !qualityScore.shouldShowScore;

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
            {'Entenda onde a estrutura perdeu força, o impacto disso na leitura cl\u00ednica e qual ajuste mais aumenta a qualidade da pr\u00f3xima coleta.'}
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
        ) : showFreeTeaser ? (
          <div className="feedback-placeholder feedback-placeholder-highlight">
            <strong>Veja onde sua anamnese perde qualidade</strong>
            <span>
              {'Desbloqueie a leitura estrutural para enxergar a nota, os pontos que mais enfraquecem o texto e a a\u00e7\u00e3o com maior impacto cl\u00ednico.'}
            </span>
            <div className="feedback-action-row">
              <button
                className="btn btn-secundario"
                type="button"
                onClick={onUpgradeInsights}
                disabled={loadingCheckout}
              >
                {loadingCheckout ? 'Abrindo checkout...' : 'Desbloquear leitura completa'}
              </button>
            </div>
            {checkoutError ? (
              <div className="feedback-secondary-error">
                {checkoutError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="feedback-placeholder">
            <strong>
              {loadingInsights ? 'Gerando leitura estrutural' : 'Análise ainda indisponível'}
            </strong>
            <span>
              {loadingInsights
                ? 'Estamos preparando a nota, as falhas principais e a ação com maior ganho para a próxima coleta.'
                : qualityScore.message || 'Gere a análise para ver onde a estrutura enfraqueceu e o que vale corrigir primeiro.'}
            </span>
          </div>
        )}

        {showAnalyzeAction && (
          <>
            {insightError ? (
              <div className="feedback-secondary-error">
                {insightError}
              </div>
            ) : null}
            <div className="feedback-action-row">
              <button
                className="btn btn-secundario"
                type="button"
                onClick={onGerarInsights}
                disabled={loadingInsights}
              >
                {loadingInsights ? 'Gerando análise...' : 'Ver leitura completa →'}
              </button>
            </div>
            <span className="feedback-helper-copy">
              {'Veja as lacunas mais relevantes e receba uma orienta\u00e7\u00e3o mais clara para a pr\u00f3xima coleta.'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default StructuralFeedback;
