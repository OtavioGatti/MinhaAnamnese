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

function getAccountStatus(user, accessState) {
  if (!user) {
    return 'Aguardando autenticação';
  }

  if (accessState?.hasActiveProAccess) {
    return 'Conta ativa com acesso profissional';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Conta ativa com acesso profissional expirado';
  }

  return 'Conta ativa no plano básico';
}

function getSidebarPreferenceLabel(activeSidebarTab) {
  const labels = {
    guide: 'Guia clínico',
    checklist: 'Checklist',
    calculator: 'Calculadoras',
    structure: 'Estrutura',
  };

  return labels[activeSidebarTab] || 'Guia clínico';
}

function getPlanLabel(accessState) {
  if (accessState?.hasActiveProAccess) {
    return 'Plano profissional';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Profissional expirado';
  }

  return 'Plano básico';
}

function getPlanSummary(accessState) {
  if (accessState?.hasActiveProAccess) {
    return `Acesso profissional ativo até ${formatPlanExpiry(accessState.planExpiresAt)}.`;
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Seu acesso profissional expirou.';
  }

  return 'Você está no plano básico.';
}

function getPlanDescription(accessState) {
  if (accessState?.hasActiveProAccess) {
    return 'Insights completos e recursos profissionais continuam liberados durante o período ativo do seu plano.';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'A organização da anamnese continua disponível. Reative o plano para voltar a ver a análise completa.';
  }

  if (accessState?.hasFreeFullInsightAvailable) {
    return 'Você ainda tem 1 análise completa grátis para experimentar antes de decidir pelo plano profissional.';
  }

  return 'A organização da anamnese continua liberada, com teaser útil e opção de destravar a análise completa quando quiser.';
}

function getFreeInsightLabel(accessState) {
  if (!accessState || accessState.hasActiveProAccess) {
    return '';
  }

  if (accessState.hasFreeFullInsightAvailable) {
    return '1 análise completa grátis disponível';
  }

  return 'Análise grátis já utilizada';
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
            <p>Centralize informações da sua conta, plano, preferências de uso e orientações de privacidade em um só lugar.</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            Aqui você poderá acompanhar o plano atual, preferências de uso, privacidade e futuros recursos pessoais do produto.
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
  const profileEmail = profile?.email || user.email || 'Não informado';
  const planSummary = getPlanSummary(accessState);
  const freeInsightLabel = getFreeInsightLabel(accessState);

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>Centralize sua conta, plano, preferências de uso e orientações de privacidade em uma área simples e confiável.</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>Informações principais da sua conta e espaço para evolução futura do perfil.</p>
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
                  <span>Teste da análise</span>
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
              <p>Resumo do acesso atual com status real de ativação e validade.</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${accessState?.hasActiveProAccess ? 'pro' : 'free'}`}>{planLabel}</span>
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
                        : 'Desbloquear análise completa'}
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
              <h2>Preferências</h2>
              <p>Estrutura inicial para personalizar o uso do produto ao longo do tempo.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>Modelo padrão</span>
                <strong>Em breve você poderá definir um modelo padrão.</strong>
              </div>
              <div className="profile-info-row">
                <span>Último template usado</span>
                <strong>{selectedTemplateName || 'Ainda não há template recente selecionado.'}</strong>
              </div>
              <div className="profile-info-row">
                <span>Apoio contextual por padrão</span>
                <strong>{getSidebarPreferenceLabel(activeSidebarTab)}</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Privacidade e dados</h2>
              <p>Comunicação clara sobre como usar o produto com mais segurança.</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">A anamnese não é armazenada pelo produto.</div>
              <div className="profile-privacy-item">Métricas agregadas de uso e evolução podem ser registradas.</div>
              <div className="profile-privacy-item">Evite inserir dados identificáveis do paciente no texto.</div>
              <div className="profile-privacy-item">Espaço preparado para política de privacidade e controles adicionais no futuro.</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
