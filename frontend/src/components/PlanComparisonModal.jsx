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
            <h2 id="plan-comparison-title">Libere a an\u00e1lise completa por {PLAN_PRICE_COPY}</h2>
            <p>{'Veja exatamente o que muda na sua revis\u00e3o cl\u00ednica antes de seguir para o checkout.'}</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-grid">
          <section className="plan-comparison-column">
            <span className="plan-comparison-badge basic">{'Plano b\u00e1sico'}</span>
            <h3>Para organizar rapidamente</h3>
            <ul>
              <li>{'organiza a anamnese em formato cl\u00ednico'}</li>
              <li>{'mant\u00e9m o fluxo principal liberado'}</li>
              <li>{'inclui 1 an\u00e1lise completa gr\u00e1tis no in\u00edcio'}</li>
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
            <h3>{'Para revisar melhor e evoluir mais r\u00e1pido'}</h3>
            <ul>
              <li>{'an\u00e1lise completa de cada caso'}</li>
              <li>principal lacuna + impacto na leitura</li>
              <li>{'pr\u00f3ximo passo cl\u00ednico'}</li>
              <li>{'hist\u00f3rico da sua evolu\u00e7\u00e3o'}</li>
              <li>acesso profissional por 30 dias</li>
            </ul>
          </section>
        </div>

        <div className="plan-comparison-highlight">
          {'Mais escolhido por quem quer transformar cada anamnese em uma oportunidade clara de evolu\u00e7\u00e3o.'}
        </div>

        <div className="plan-comparison-reassurance">
          <strong>Por que costuma valer a pena?</strong>
          <span>{'Um \u00fanico caso melhor revisado j\u00e1 pode economizar tempo, reduzir retrabalho e mostrar exatamente o que perguntar melhor na pr\u00f3xima coleta.'}</span>
        </div>

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            {'Ainda n\u00e3o'}
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
