function formatPlanExpiry(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('pt-BR');
}

function isPlanExpiringSoon(value, thresholdInDays = 5) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const diffDays = (parsed.getTime() - Date.now()) / 86400000;
  return diffDays > 0 && diffDays <= thresholdInDays;
}

function getSidebarPreferenceLabel(activeSidebarTab) {
  const labels = {
    guide: 'Guia cl\u00ednico',
    calculator: 'Calculadoras',
  };

  return labels[activeSidebarTab] || 'Guia cl\u00ednico';
}

function getPlanLabel(accessState) {
  if (accessState?.hasActiveProAccess) {
    return 'Plano profissional';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Profissional expirado';
  }

  return 'Plano b\u00e1sico';
}

function getPlanSummary(accessState) {
  if (accessState?.hasActiveProAccess) {
    if (!accessState.planExpiresAt) {
      return 'Acesso profissional ativo.';
    }

    return `Acesso profissional ativo at\u00e9 ${formatPlanExpiry(accessState.planExpiresAt)}.`;
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Seu acesso profissional expirou.';
  }

  return 'Voc\u00ea est\u00e1 no plano b\u00e1sico.';
}

function getPlanDescription(accessState) {
  if (accessState?.hasActiveProAccess) {
    if (isPlanExpiringSoon(accessState.planExpiresAt)) {
      return 'Renove agora para continuar com an\u00e1lise completa e evolu\u00e7\u00e3o sem interrup\u00e7\u00f5es.';
    }

    return 'Sua conta segue com an\u00e1lise completa, pr\u00f3ximo passo cl\u00ednico e hist\u00f3rico liberados durante o per\u00edodo ativo.';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'A organiza\u00e7\u00e3o continua liberada. Reative o profissional por R$ 9,90 para recuperar a an\u00e1lise completa por 30 dias.';
  }

  if (accessState?.hasFreeFullInsightAvailable) {
    return 'Voc\u00ea ainda tem 1 an\u00e1lise completa gr\u00e1tis para experimentar. Depois, o profissional custa R$ 9,90 por 30 dias.';
  }

  return 'A organiza\u00e7\u00e3o da anamnese continua liberada. Quando quiser aprofundar a revis\u00e3o, destrave a an\u00e1lise completa por R$ 9,90.';
}

function getFreeInsightLabel(accessState) {
  if (!accessState || accessState.hasActiveProAccess) {
    return '';
  }

  if (accessState.hasFreeFullInsightAvailable) {
    return '1 an\u00e1lise completa gr\u00e1tis dispon\u00edvel';
  }

  return 'An\u00e1lise gr\u00e1tis j\u00e1 utilizada';
}

function ProfilePage({
  user,
  profile,
  accessState,
  selectedTemplateName,
  activeSidebarTab,
  onUpgrade,
  onSignOut,
  onGoHome,
  onGoTemplates,
  loadingCheckout,
  checkoutError,
}) {
  if (!user) {
    return (
      <div className="profile-page">
        <section className="workspace-surface profile-hero">
          <div className="profile-hero-copy">
            <span className="workspace-kicker">Conta</span>
            <h1>Seu perfil</h1>
            <p>{'Centralize informa\u00e7\u00f5es da sua conta, plano, prefer\u00eancias de uso e orienta\u00e7\u00f5es de privacidade em um s\u00f3 lugar.'}</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            {'Aqui voc\u00ea poder\u00e1 acompanhar o plano atual, prefer\u00eancias de uso, privacidade e futuros recursos pessoais do produto.'}
          </span>
          <div className="profile-empty-actions">
            <button type="button" className="btn btn-primario" onClick={onGoHome}>
              Ir para Home
            </button>
            <button type="button" className="btn btn-secundario" onClick={onGoTemplates}>
              Explorar Templates
            </button>
          </div>
        </section>
      </div>
    );
  }

  const planLabel = getPlanLabel(accessState);
  const profileEmail = profile?.email || user.email || 'N\u00e3o informado';
  const planSummary = getPlanSummary(accessState);
  const freeInsightLabel = getFreeInsightLabel(accessState);
  const showExpiringSoon = accessState?.hasActiveProAccess && isPlanExpiringSoon(accessState?.planExpiresAt);

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>{'Centralize sua conta, plano, prefer\u00eancias de uso e orienta\u00e7\u00f5es de privacidade em uma \u00e1rea simples e confi\u00e1vel.'}</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>{'Informa\u00e7\u00f5es b\u00e1sicas de acesso ao produto.'}</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>E-mail</span>
                <strong>{profileEmail}</strong>
              </div>
            </div>

            <div className="profile-card-actions">
              <button type="button" className="btn btn-secundario" onClick={onSignOut}>
                Sair
              </button>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Plano</h2>
              <p>{'Resumo do acesso atual com status real de ativa\u00e7\u00e3o e validade.'}</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${accessState?.hasActiveProAccess ? 'pro' : 'free'}`}>{planLabel}</span>
              {showExpiringSoon ? (
                <span className="profile-plan-alert">Seu acesso profissional termina em breve</span>
              ) : null}
              <strong>{planSummary}</strong>
              <p>{getPlanDescription(accessState)}</p>
              {freeInsightLabel ? (
                <div className="profile-plan-note">
                  <span>{'Teste da an\u00e1lise'}</span>
                  <strong>{freeInsightLabel}</strong>
                </div>
              ) : null}
            </div>

            <div className="profile-card-actions">
              {!accessState?.hasActiveProAccess ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={onUpgrade}
                    disabled={loadingCheckout}
                  >
                    {loadingCheckout
                      ? 'Abrindo checkout...'
                      : accessState?.billingStatus === 'expired'
                        ? 'Reativar por R$ 9,90'
                        : 'Liberar an\u00e1lise completa por R$ 9,90'}
                  </button>
                  {checkoutError ? <div className="topbar-auth-error">{checkoutError}</div> : null}
                </>
              ) : (
                <button type="button" className="btn btn-secundario" disabled>
                  Gerenciar plano
                  <span className="templates-soon-chip">Em breve</span>
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>{'Prefer\u00eancias'}</h2>
              <p>Estrutura inicial para personalizar o uso do produto ao longo do tempo.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>{'Modelo padr\u00e3o'}</span>
                <strong>{'Em breve voc\u00ea poder\u00e1 definir um modelo padr\u00e3o.'}</strong>
              </div>
              <div className="profile-info-row">
                <span>{'\u00daltimo template usado'}</span>
                <strong>{selectedTemplateName || 'Ainda n\u00e3o h\u00e1 template recente selecionado.'}</strong>
              </div>
              <div className="profile-info-row">
                <span>{'Apoio contextual por padr\u00e3o'}</span>
                <strong>{getSidebarPreferenceLabel(activeSidebarTab)}</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Privacidade e dados</h2>
              <p>{'Comunica\u00e7\u00e3o clara sobre como usar o produto com mais seguran\u00e7a.'}</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">{'Evite inserir dados identific\u00e1veis do paciente no texto.'}</div>
              <div className="profile-privacy-item">{'O texto \u00e9 processado por IA para gerar a organiza\u00e7\u00e3o e a an\u00e1lise.'}</div>
              <div className="profile-privacy-item">{'O produto n\u00e3o salva o texto como prontu\u00e1rio; m\u00e9tricas agregadas de uso e evolu\u00e7\u00e3o podem ser registradas.'}</div>
              <div className="profile-privacy-item">{'Espa\u00e7o preparado para pol\u00edtica de privacidade e controles adicionais no futuro.'}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
