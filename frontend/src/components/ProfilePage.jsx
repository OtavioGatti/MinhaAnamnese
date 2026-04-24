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

function getAccountStatus(user, accessState) {
  if (!user) {
    return 'Aguardando autenticacao';
  }

  if (accessState?.hasActiveProAccess) {
    return 'Conta ativa com acesso profissional';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Conta ativa com acesso profissional expirado';
  }

  return 'Conta ativa no plano basico';
}

function getSidebarPreferenceLabel(activeSidebarTab) {
  const labels = {
    guide: 'Guia clinico',
    checklist: 'Checklist',
    calculator: 'Calculadoras',
    structure: 'Estrutura',
  };

  return labels[activeSidebarTab] || 'Guia clinico';
}

function getPlanLabel(accessState) {
  if (accessState?.hasActiveProAccess) {
    return 'Plano profissional';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Profissional expirado';
  }

  return 'Plano basico';
}

function getPlanSummary(accessState) {
  if (accessState?.hasActiveProAccess) {
    return `Acesso profissional ativo ate ${formatPlanExpiry(accessState.planExpiresAt)}.`;
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Seu acesso profissional expirou.';
  }

  return 'Voce esta no plano basico.';
}

function getPlanDescription(accessState) {
  if (accessState?.hasActiveProAccess) {
    if (isPlanExpiringSoon(accessState.planExpiresAt)) {
      return 'Renove agora para continuar com analise completa e evolucao sem interrupcoes.';
    }

    return 'Sua conta segue com analise completa, proximo passo clinico e historico liberados durante o periodo ativo.';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'A organizacao continua liberada, mas a analise completa voltou a ficar indisponivel.';
  }

  if (accessState?.hasFreeFullInsightAvailable) {
    return 'Voce ainda tem 1 analise completa gratis para experimentar antes de decidir pelo plano profissional.';
  }

  return 'A organizacao da anamnese continua liberada. Quando quiser aprofundar a revisao, voce pode destravar a analise completa.';
}

function getFreeInsightLabel(accessState) {
  if (!accessState || accessState.hasActiveProAccess) {
    return '';
  }

  if (accessState.hasFreeFullInsightAvailable) {
    return '1 analise completa gratis disponivel';
  }

  return 'Analise gratis ja utilizada';
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
            <p>Centralize informacoes da sua conta, plano, preferencias de uso e orientacoes de privacidade em um so lugar.</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            Aqui voce podera acompanhar o plano atual, preferencias de uso, privacidade e futuros recursos pessoais do produto.
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
  const profileEmail = profile?.email || user.email || 'Nao informado';
  const planSummary = getPlanSummary(accessState);
  const freeInsightLabel = getFreeInsightLabel(accessState);
  const showExpiringSoon = accessState?.hasActiveProAccess && isPlanExpiringSoon(accessState?.planExpiresAt);

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>Centralize sua conta, plano, preferencias de uso e orientacoes de privacidade em uma area simples e confiavel.</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>Informacoes principais da sua conta e espaco para evolucao futura do perfil.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>E-mail</span>
                <strong>{profileEmail}</strong>
              </div>
              <div className="profile-info-row">
                <span>Status da conta</span>
                <strong>{getAccountStatus(user, accessState)}</strong>
              </div>
              <div className="profile-info-row">
                <span>Plano atual</span>
                <strong>{planSummary}</strong>
              </div>
              {freeInsightLabel ? (
                <div className="profile-info-row">
                  <span>Teste da analise</span>
                  <strong>{freeInsightLabel}</strong>
                </div>
              ) : null}
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
              <p>Resumo do acesso atual com status real de ativacao e validade.</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${accessState?.hasActiveProAccess ? 'pro' : 'free'}`}>{planLabel}</span>
              {showExpiringSoon ? (
                <span className="profile-plan-alert">Seu acesso profissional termina em breve</span>
              ) : null}
              <strong>{planSummary}</strong>
              <p>{getPlanDescription(accessState)}</p>
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
                        ? 'Reativar plano profissional'
                        : 'Quero liberar minha analise completa'}
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
              <h2>Preferencias</h2>
              <p>Estrutura inicial para personalizar o uso do produto ao longo do tempo.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>Modelo padrao</span>
                <strong>Em breve voce podera definir um modelo padrao.</strong>
              </div>
              <div className="profile-info-row">
                <span>Ultimo template usado</span>
                <strong>{selectedTemplateName || 'Ainda nao ha template recente selecionado.'}</strong>
              </div>
              <div className="profile-info-row">
                <span>Apoio contextual por padrao</span>
                <strong>{getSidebarPreferenceLabel(activeSidebarTab)}</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Privacidade e dados</h2>
              <p>Comunicacao clara sobre como usar o produto com mais seguranca.</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">A anamnese nao e armazenada pelo produto.</div>
              <div className="profile-privacy-item">Metricas agregadas de uso e evolucao podem ser registradas.</div>
              <div className="profile-privacy-item">Evite inserir dados identificaveis do paciente no texto.</div>
              <div className="profile-privacy-item">Espaco preparado para politica de privacidade e controles adicionais no futuro.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
