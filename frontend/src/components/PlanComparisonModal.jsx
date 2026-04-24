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
            <h2 id="plan-comparison-title">Escolha como voce quer evoluir sua revisao clinica</h2>
            <p>Veja claramente o que voce ja ganhou e o que o plano profissional destrava antes de seguir para o checkout.</p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-grid">
          <section className="plan-comparison-column">
            <span className="plan-comparison-badge basic">Plano basico</span>
            <h3>Para organizar rapidamente</h3>
            <ul>
              <li>organiza a anamnese em formato clinico</li>
              <li>mantem o fluxo principal liberado</li>
              <li>inclui 1 analise completa gratis no inicio</li>
              <li>ideal para experimentar</li>
            </ul>
          </section>

          <section className="plan-comparison-column featured">
            <span className="plan-comparison-badge pro">Plano profissional</span>
            <h3>Para revisar melhor e evoluir mais rapido</h3>
            <ul>
              <li>analise completa de cada caso</li>
              <li>principal lacuna + impacto na leitura</li>
              <li>proximo passo clinico</li>
              <li>historico da sua evolucao</li>
              <li>acesso profissional por 30 dias</li>
            </ul>
          </section>
        </div>

        <div className="plan-comparison-highlight">
          Mais escolhido por quem quer melhorar a qualidade da coleta clinica
        </div>

        <div className="app-modal-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Ainda nao
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading ? 'Abrindo checkout...' : 'Quero liberar minha analise completa'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanComparisonModal;
