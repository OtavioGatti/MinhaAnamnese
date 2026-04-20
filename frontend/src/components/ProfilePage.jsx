function getAccountStatus(user, isPro) {
  if (!user) {
    return 'Aguardando autenticação';
  }

  return isPro ? 'Conta ativa com acesso profissional' : 'Conta ativa no plano básico';
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

function ProfilePage({
  user,
  isPro,
  selectedTemplateName,
  activeSidebarTab,
  onUpgrade,
  onSignOut,
  onGoHome,
  onGoTemplates,
  loadingCheckout,
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
                <strong>{user.email || 'Não informado'}</strong>
              </div>
              <div className="profile-info-row">
                <span>Status da conta</span>
                <strong>{getAccountStatus(user, isPro)}</strong>
              </div>
              <div className="profile-info-row">
                <span>Nome do perfil</span>
                <strong>Em breve você poderá editar seu nome e identidade de uso.</strong>
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
              <p>Resumo do acesso atual e espaço preparado para futuros controles de assinatura.</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${isPro ? 'pro' : 'free'}`}>
                {isPro ? 'Plano profissional' : 'Plano básico'}
              </span>
              <strong>
                {isPro
                  ? 'Seu acesso profissional está ativo.'
                  : 'Você está no plano básico com acesso ao fluxo principal.'}
              </strong>
              <p>
                {isPro
                  ? 'Insights completos e recursos profissionais estão liberados na sua conta.'
                  : 'A organização da anamnese continua liberada, com opção de evoluir para recursos profissionais quando quiser.'}
              </p>
            </div>

            <div className="profile-card-actions">
              {!isPro ? (
                <button
                  type="button"
                  className="btn btn-primario"
                  onClick={onUpgrade}
                  disabled={loadingCheckout}
                >
                  {loadingCheckout ? 'Abrindo checkout...' : 'Fazer upgrade'}
                </button>
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

          <section className="profile-card profile-future-card">
            <div className="profile-card-header">
              <h2>Futuro</h2>
              <p>Recursos pessoais já previstos para a evolução natural do produto.</p>
            </div>

            <div className="profile-future-list">
              <div className="profile-future-item">
                <strong>Meus templates</strong>
                <span>Em breve</span>
              </div>
              <div className="profile-future-item">
                <strong>Favoritos</strong>
                <span>Em breve</span>
              </div>
              <div className="profile-future-item">
                <strong>Preferências clínicas</strong>
                <span>Em breve</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
