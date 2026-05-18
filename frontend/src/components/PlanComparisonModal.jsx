const PLAN_PRICE_COPY = 'R$ 9,90';
const PLAN_PERIOD_COPY = '30 dias';

function PlanComparisonModal({ open, loading, isTrialAccess, onClose, onConfirm }) {
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
            <h2 id="plan-comparison-title">
              {isTrialAccess ? 'Mantenha o Plano Profissional depois do teste' : `Assine o Plano Profissional por ${PLAN_PRICE_COPY}`}
            </h2>
            <p>
              {isTrialAccess
                ? 'A assinatura preserva o acesso atual e adiciona 30 dias ao fim do teste.'
                : 'Veja o que muda antes de seguir para o checkout.'}
            </p>
          </div>
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="plan-comparison-scroll-region">
          <div className="plan-comparison-grid">
          <section className="plan-comparison-column">
            <span className="plan-comparison-badge basic">Plano básico</span>
            <h3>Para organizar rapidamente</h3>
            <ul>
              <li>organiza a anamnese em formato clínico</li>
              <li>mantém modelos oficiais no fluxo principal</li>
              <li>preserva seus dados e preferências básicas</li>
              <li>ideal para uso pontual sem recursos de IA pagos</li>
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
            <h3>Para usar o workspace completo</h3>
            <ul>
              <li>avaliação completa de anamneses</li>
              <li>cartas de encaminhamento com IA</li>
              <li>guias de prescrição por patologia</li>
              <li>templates próprios para sua rotina</li>
              <li>histórico da sua evolução</li>
            </ul>
          </section>
          </div>

          <div className="plan-comparison-highlight">
          O teste profissional libera uma amostra real do fluxo completo; a assinatura mantém esse acesso sem os limites do teste.
          </div>

          <div className="plan-comparison-reassurance">
          <strong>Por que costuma valer a pena?</strong>
          <span>Um único caso melhor revisado já pode economizar tempo, reduzir retrabalho e mostrar exatamente o que perguntar melhor na próxima coleta.</span>
          </div>
        </div>

        <div className="app-modal-actions plan-comparison-actions">
          <button type="button" className="btn btn-secundario" onClick={onClose}>
            Ainda não
          </button>
          <button type="button" className="btn btn-primario" onClick={onConfirm} disabled={loading}>
            {loading ? 'Abrindo checkout...' : isTrialAccess ? `Assinar por ${PLAN_PRICE_COPY}` : `Continuar por ${PLAN_PRICE_COPY}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanComparisonModal;
