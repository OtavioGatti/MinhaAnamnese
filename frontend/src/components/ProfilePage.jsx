const PLAN_PRICE_COPY = 'R$ 9,90';
const PLAN_PERIOD_COPY = '30 dias';

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
    guide: 'Guia clinico',
    calculator: 'Calculadoras',
  };

  return labels[activeSidebarTab] || 'Guia clinico';
}

function getPlanLabel(accessState) {
  if (accessState?.isTrialAccess) {
    return 'Teste profissional';
  }

  if (accessState?.hasActiveProAccess) {
    return 'Plano profissional';
  }

  if (accessState?.isTrialExpired) {
    return 'Teste encerrado';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Profissional expirado';
  }

  return 'Plano basico';
}

function getPlanSummary(accessState) {
  if (accessState?.isTrialAccess) {
    return `Teste profissional ativo ate ${formatPlanExpiry(accessState.trialEndsAt || accessState.planExpiresAt)}.`;
  }

  if (accessState?.hasActiveProAccess) {
    if (!accessState.planExpiresAt) {
      return 'Acesso profissional ativo.';
    }

    return `Acesso profissional ativo ate ${formatPlanExpiry(accessState.planExpiresAt)}.`;
  }

  if (accessState?.isTrialExpired) {
    return 'Seu teste profissional terminou.';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Seu acesso profissional expirou.';
  }

  return 'Voce esta no plano basico.';
}

function getPlanDescription(accessState) {
  if (accessState?.isTrialAccess) {
    const days = accessState.trialDaysRemaining || 1;
    return `Voce esta testando os recursos profissionais por mais ${days} ${days === 1 ? 'dia' : 'dias'}. Ao final, sua conta volta ao basico.`;
  }

  if (accessState?.hasActiveProAccess) {
    if (isPlanExpiringSoon(accessState.planExpiresAt)) {
      return 'Renove agora para continuar com analises, encaminhamentos e guias sem interrupcoes.';
    }

    return 'Sua conta segue com avaliacoes completas, encaminhamentos com IA, guias de prescricao e templates proprios liberados.';
  }

  if (accessState?.isTrialExpired) {
    return `A organizacao basica continua liberada. Assine por ${PLAN_PRICE_COPY} para recuperar os recursos profissionais por ${PLAN_PERIOD_COPY}.`;
  }

  if (accessState?.billingStatus === 'expired') {
    return `A organizacao basica continua liberada. Reative o profissional por ${PLAN_PRICE_COPY} para recuperar os recursos Pro por ${PLAN_PERIOD_COPY}.`;
  }

  return `A organizacao basica continua liberada. Assine por ${PLAN_PRICE_COPY} para usar IA, encaminhamentos, guias e templates proprios.`;
}

function getTrialUsageRows(trialUsage) {
  if (!trialUsage?.limits || !trialUsage?.remaining) {
    return [];
  }

  return [
    ['Avaliacoes completas', 'insights'],
    ['Encaminhamentos', 'referralLetters'],
    ['Guias de prescricao', 'prescriptionGuides'],
    ['Templates proprios', 'userTemplates'],
  ].map(([label, key]) => ({
    label,
    remaining: trialUsage.remaining[key] ?? 0,
    limit: trialUsage.limits[key] ?? 0,
  }));
}

function ProfilePage({
  user,
  profile,
  accessState,
  trialUsage,
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
            <p>{'Centralize informacoes da sua conta, plano, preferencias de uso e orientacoes de privacidade em um so lugar.'}</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            {'Aqui voce podera acompanhar o plano atual, preferencias de uso, privacidade e futuros recursos pessoais do produto.'}
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
  const showExpiringSoon = accessState?.hasActiveProAccess && isPlanExpiringSoon(accessState?.planExpiresAt);
  const trialRows = accessState?.isTrialAccess ? getTrialUsageRows(trialUsage || profile?.trial_usage) : [];
  const shouldShowUpgradeAction = !accessState?.hasActiveProAccess || accessState?.isTrialAccess;

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>{'Centralize sua conta, plano, preferencias de uso e orientacoes de privacidade em uma area simples e confiavel.'}</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>{'Informacoes basicas de acesso ao produto.'}</p>
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
              <p>{'Resumo do acesso atual com status real de ativacao e validade.'}</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${accessState?.hasActiveProAccess ? 'pro' : 'free'}`}>{planLabel}</span>
              {showExpiringSoon ? (
                <span className="profile-plan-alert">Seu acesso profissional termina em breve</span>
              ) : null}
              <strong>{planSummary}</strong>
              <p>{getPlanDescription(accessState)}</p>
              {trialRows.length ? (
                <div className="profile-plan-note">
                  <span>{'Uso do teste'}</span>
                  <strong>{trialRows.map((row) => `${row.remaining}/${row.limit} ${row.label}`).join(' | ')}</strong>
                </div>
              ) : null}
            </div>

            <div className="profile-card-actions">
              {shouldShowUpgradeAction ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={onUpgrade}
                    disabled={loadingCheckout}
                  >
                    {loadingCheckout
                      ? 'Abrindo checkout...'
                      : accessState?.isTrialAccess
                        ? 'Assinar e manter o Profissional'
                        : accessState?.billingStatus === 'expired'
                          ? `Reativar por ${PLAN_PRICE_COPY}`
                          : `Assinar por ${PLAN_PRICE_COPY}`}
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
              <h2>{'Preferencias'}</h2>
              <p>Estrutura inicial para personalizar o uso do produto ao longo do tempo.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>Template padrao recente</span>
                <strong>{selectedTemplateName || 'Ainda nao definido'}</strong>
              </div>
              <div className="profile-info-row">
                <span>Painel contextual</span>
                <strong>{getSidebarPreferenceLabel(activeSidebarTab)}</strong>
              </div>
              <div className="profile-info-row">
                <span>Recursos basicos</span>
                <strong>Organizacao da anamnese liberada</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>{'Privacidade'}</h2>
              <p>{'Comunicacao clara sobre como usar o produto com mais seguranca.'}</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">{'Evite inserir dados identificaveis do paciente no texto.'}</div>
              <div className="profile-privacy-item">{'O texto e processado por IA para gerar organizacao, analises e encaminhamentos.'}</div>
              <div className="profile-privacy-item">{'O produto nao salva o texto como prontuario; metricas agregadas de uso e evolucao podem ser registradas.'}</div>
              <div className="profile-privacy-item">{'Espaco preparado para politica de privacidade e controles adicionais no futuro.'}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
