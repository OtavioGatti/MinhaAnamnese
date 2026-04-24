function DetailedAnalysis({
  aberto,
  onToggle,
  showDetailedContent,
  analysisInputSection,
  summarizedScoreJustification,
  insightPrincipalSection,
  secondaryGaps,
}) {
  return (
    <div className="card section-secondary">
      <button
        type="button"
        className="secondary-toggle"
        onClick={onToggle}
      >
        <div className="secondary-toggle-copy">
          <strong>{aberto ? 'Ocultar análise detalhada' : 'Ver análise detalhada'}</strong>
          <span>Abra apenas se quiser revisar a leitura completa e os dados complementares.</span>
        </div>
        <span className="secondary-toggle-icon" aria-hidden="true">
          {aberto ? '▲' : '▼'}
        </span>
      </button>

      {aberto && showDetailedContent && (
        <div className="secondary-section-grid">
          <div className="secondary-support-card">
            <div className="card-header">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M12 4h9" />
                <path d="M4 9h16" />
                <path d="M4 15h16" />
              </svg>
              <h2>Análise detalhada</h2>
            </div>

            <div className="detailed-analysis-grid">
              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Leitura completa</h3>
                <div className="resultado">{analysisInputSection}</div>
              </div>

              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Justificativa da nota</h3>
                <div className="resultado">{summarizedScoreJustification}</div>
              </div>

              <div className="detailed-analysis-block">
                <h3 className="detailed-analysis-title">Ponto crítico</h3>
                <div className="resultado">{insightPrincipalSection}</div>
              </div>

              {Array.isArray(secondaryGaps) && secondaryGaps.length > 0 ? (
                <div className="detailed-analysis-block">
                  <h3 className="detailed-analysis-title">Outras lacunas relevantes</h3>
                  <div className="resultado">
                    {secondaryGaps.slice(0, 4).map((gap) => (
                      <div key={gap}>- {gap}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailedAnalysis;
