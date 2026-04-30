const PLAN_PRICE_COPY = 'R$ 9,90';
const PLAN_PERIOD_COPY = '30 dias';

function PlanComparisonModal({ open, loading, onClose, onConfirm }) {
  if (!open) {
    return null;
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
            <h2 id="plan-comparison-title">Libere a análise completa por {PLAN_PRICE_COPY}</h2>
            <p>Veja exatamente o que muda na sua revisão clínica antes de seguir para o checkout.</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-grid">
          <section className="plan-comparison-column">
            <span className="plan-comparison-badge basic">Plano básico</span>
            <h3>Para organizar rapidamente</h3>
            <ul>
              <li>organiza a anamnese em formato clínico</li>
              <li>mantém o fluxo principal liberado</li>
              <li>inclui 1 análise completa grátis no início</li>
              <li>ideal para experimentar</li>
            </ul>
          </section>

          <section className="plan-comparison-column featured">
            <div className="plan-comparison-featured-top">
              <span className="plan-comparison-badge pro">Plano profissional</span>
              <div className="plan-comparison-price">
                <strong>{PLAN_PRICE_COPY}</strong>
                <span>{PLAN_PERIOD_COPY}</span>
              </div>
            </div>
            <h3>Para revisar melhor e evoluir mais rápido</h3>
            <ul>
              <li>análise completa de cada caso</li>
              <li>principal lacuna + impacto na leitura</li>
              <li>próximo passo clínico</li>
              <li>histórico da sua evolução</li>
              <li>acesso profissional por 30 dias</li>
            </ul>
          </section>
        </div>

        <div className="plan-comparison-highlight">
          Mais escolhido por quem quer transformar cada anamnese em uma oportunidade clara de evolução.
        </div>

        <div className="plan-comparison-reassurance">
          <strong>Por que costuma valer a pena?</strong>
          <span>Um único caso melhor revisado já pode economizar tempo, reduzir retrabalho e mostrar exatamente o que perguntar melhor na próxima coleta.</span>
        </div>

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Ainda não
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading ? 'Abrindo checkout...' : `Liberar por ${PLAN_PRICE_COPY}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanComparisonModal;
