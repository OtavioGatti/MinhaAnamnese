function DetailedAnalysis({
  aberto,
  onToggle,
  showDetailedContent,
  analysisInputSection,
  summarizedScoreJustification,
  insightPrincipalSection,
  secondaryGaps,
  user,
  loadingFunnelMetrics,
  funnelMetrics,
  shouldShowFunnelMetrics,
}) {
  return (
    <div className="card section-secondary">
      <button
        type="button"
        className="secondary-toggle"
        onClick={onToggle}
      >
        <div className="secondary-toggle-copy">
          <strong>{aberto ? 'Ocultar an\u00e1lise detalhada' : 'Ver an\u00e1lise detalhada'}</strong>
          <span>{'Abra apenas se quiser revisar a leitura completa e os dados complementares.'}</span>
        </div>
        <span className="secondary-toggle-icon" aria-hidden="true">
          {aberto ? '\u25b2' : '\u25bc'}
        </span>
      </button>

      {aberto && (
        <div className="secondary-section-grid">
          {showDetailedContent && (
            <div className="secondary-support-card">
              <div className="card-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M12 4h9" />
                  <path d="M4 9h16" />
                  <path d="M4 15h16" />
                </svg>
                <h2>{'An\u00e1lise detalhada'}</h2>
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
                  <h3 className="detailed-analysis-title">{'Ponto cr\u00edtico'}</h3>
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
          )}

          {user && shouldShowFunnelMetrics && (
            <div className="secondary-support-card">
              <div className="card-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
                <h2>{'M\u00e9tricas do funil'}</h2>
              </div>

              {loadingFunnelMetrics ? (
                <p className="field-helper">{'Carregando m\u00e9tricas do funil...'}</p>
              ) : !funnelMetrics || funnelMetrics.total_sessoes === 0 || funnelMetrics.etapas.length === 0 ? (
                <div className="empty-state-hint">
                  {'As m\u00e9tricas do funil aparecer\u00e3o conforme novas sess\u00f5es forem registradas.'}
                </div>
              ) : (
                <div className="funnel-metrics-grid">
                  <div className="funnel-summary">
                    {'Total de sess\u00f5es: '}<strong>{funnelMetrics.total_sessoes}</strong>
                  </div>

                  <div className="funnel-grid">
                    <div className="funnel-grid-head">Etapa</div>
                    <div className="funnel-grid-head">Total</div>
                    <div className="funnel-grid-head">{'Convers\u00e3o'}</div>
                    <div className="funnel-grid-head">Queda</div>

                    {funnelMetrics.etapas.map((etapa) => (
                      <div key={etapa.nome} style={{ display: 'contents' }}>
                        <div className="funnel-grid-cell funnel-grid-stage">{etapa.nome}</div>
                        <div className="funnel-grid-cell funnel-grid-value">{etapa.total}</div>
                        <div className="funnel-grid-cell funnel-grid-value">{etapa.taxa_conversao}%</div>
                        <div className="funnel-grid-cell">{etapa.queda}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DetailedAnalysis;
