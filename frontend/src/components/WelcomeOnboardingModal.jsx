function WelcomeOnboardingModal({
  open,
  trialDaysCopy,
  priceCopy,
  onClose,
  onStart,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="app-modal-card welcome-onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-onboarding-title"
        aria-describedby="welcome-onboarding-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-onboarding-header">
          <div>
            <span className="workspace-kicker">Boas-vindas</span>
            <h2 id="welcome-onboarding-title">Bem-vindo ao Minha Anamnese</h2>
          </div>
          <button
            type="button"
            className="welcome-onboarding-close"
            onClick={onClose}
            aria-label="Fechar boas-vindas"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <p id="welcome-onboarding-description" className="welcome-onboarding-copy">
          Organize anamneses, revise lacunas e acelere encaminhamentos e prescrições em um único workspace clínico.
        </p>

        <div className="welcome-onboarding-trial">
          <strong>{trialDaysCopy} grátis no Plano Profissional</strong>
          <span>Depois do teste, você decide se quer continuar a partir de {priceCopy} por mês ou escolher o semestral.</span>
        </div>

        <ul className="welcome-onboarding-list">
          <li>Análise completa das anamneses</li>
          <li>Cartas de encaminhamento com IA</li>
          <li>Guias de prescrição por patologia</li>
          <li>Templates próprios para sua rotina</li>
        </ul>

        <div className="app-modal-actions welcome-onboarding-actions">
          <button type="button" className="btn btn-primario" onClick={onStart}>
            Começar agora
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeOnboardingModal;
