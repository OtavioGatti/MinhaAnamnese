function getReferralAccessCopy({ user, accessState }) {
  if (!user?.id) {
    return {
      title: 'Entre para gerar encaminhamentos',
      description: 'Crie uma conta para iniciar o teste profissional completo e experimentar cartas de encaminhamento com IA.',
      buttonLabel: 'Entrar',
    };
  }

  if (!accessState?.hasActiveProAccess) {
    return {
      title: accessState?.isTrialExpired ? 'Teste profissional encerrado' : 'Recurso do Plano Profissional',
      description: 'Cartas de encaminhamento usam IA e ficam disponíveis no Profissional.',
      buttonLabel: 'Assinar Pro',
    };
  }

  return null;
}

function ReferralLetterCard({
  specialty,
  reason,
  letter,
  loading,
  error,
  checkoutError,
  copied,
  user,
  accessState,
  loadingCheckout,
  onSpecialtyChange,
  onReasonChange,
  onGenerate,
  onCopy,
  onRequestUpgrade,
  onDismissError,
}) {
  const accessCopy = getReferralAccessCopy({ user, accessState });
  const shouldUseUpgradeAction = Boolean(accessCopy);
  return (
    <section className="card referral-letter-card section-referral workspace-panel">
      <div className="card-header card-header-with-copy referral-letter-header">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16v16H4z" />
          <path d="M4 8h16" />
          <path d="M8 4v16" />
          <path d="M12 12h5" />
          <path d="M12 16h4" />
        </svg>
        <div>
          <h2>Carta de encaminhamento</h2>
          <p className="card-subtitle">
            {'O texto considera a história clínica e prioriza dados relevantes para a especialidade escolhida.'}
          </p>
        </div>
      </div>

      <div className="referral-letter-grid">
        <div className="form-group referral-field">
          <label htmlFor="referral-specialty">{'Especialidade de destino'}</label>
          <div className="input-wrapper">
            <input
              id="referral-specialty"
              type="text"
              value={specialty}
              onChange={(event) => onSpecialtyChange(event.target.value)}
              placeholder="Ex: Otorrinolaringologia"
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group referral-field">
          <label htmlFor="referral-reason">{'Motivo do encaminhamento'}</label>
          <div className="input-wrapper">
            <input
              id="referral-reason"
              type="text"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Ex: otorragia, perda auditiva, cefaleia refratária"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {accessCopy ? (
        <div className="paywall-panel">
          <div>
            <strong>{accessCopy.title}</strong>
            <span>{accessCopy.description}</span>
          </div>
          {checkoutError ? <div className="feedback-secondary-error">{checkoutError}</div> : null}
        </div>
      ) : null}

      <div className="referral-actions">
        <button
          type="button"
          className="btn btn-primario referral-generate-button"
          onClick={shouldUseUpgradeAction ? onRequestUpgrade : onGenerate}
          disabled={loading || loadingCheckout}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Gerando carta...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              {loadingCheckout ? 'Abrindo checkout...' : shouldUseUpgradeAction ? accessCopy.buttonLabel : 'Gerar carta'}
            </>
          )}
        </button>
        <span className="referral-helper">
          {'Use o motivo para orientar o recorte clínico quando a anamnese tiver muitas informações.'}
        </span>
      </div>

      {error && (
        <div className="erro referral-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="erro-copy">
            <strong>Revise antes de gerar</strong>
            <span>{error}</span>
          </div>
          <button
            className="btn-erro-dismiss"
            onClick={onDismissError}
            title="Fechar"
            type="button"
          >
            {'\u00d7'}
          </button>
        </div>
      )}

      {letter && (
        <div className="referral-letter-output">
          <div className="referral-letter-output-header">
            <div>
              <strong>Carta pronta para revisar</strong>
              <span>{'A cópia mantém o formato abaixo.'}</span>
            </div>
            <button
              type="button"
              className={`btn btn-copiar btn-copiar-inline ${copied ? 'copiado' : ''}`}
              onClick={onCopy}
            >
              {copied ? 'Copiado!' : 'Copiar carta'}
            </button>
          </div>
          <pre className="referral-letter-text">{letter}</pre>
        </div>
      )}
    </section>
  );
}

export default ReferralLetterCard;
