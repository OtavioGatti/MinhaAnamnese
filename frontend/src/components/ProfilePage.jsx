import { PRO_PLAN_PERIOD_COPY, PRO_PLAN_PRICE_COPY } from '../billingPlans';

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
    guide: 'Guia clínico',
    calculator: 'Calculadoras',
  };

  return labels[activeSidebarTab] || 'Guia clínico';
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

  return 'Plano básico';
}

function getPlanSummary(accessState) {
  if (accessState?.isTrialAccess) {
    return `Teste profissional ativo até ${formatPlanExpiry(accessState.trialEndsAt || accessState.planExpiresAt)}.`;
  }

  if (accessState?.hasActiveProAccess) {
    if (!accessState.planExpiresAt) {
      return 'Acesso profissional ativo.';
    }

    return `Acesso profissional ativo até ${formatPlanExpiry(accessState.planExpiresAt)}.`;
  }

  if (accessState?.isTrialExpired) {
    return 'Seu teste profissional terminou.';
  }

  if (accessState?.billingStatus === 'expired') {
    return 'Seu acesso profissional expirou.';
  }

  return 'Você está no plano básico.';
}

function getPlanDescription(accessState) {
  if (accessState?.isTrialAccess) {
    const days = accessState.trialDaysRemaining || 1;
    return `Você está testando os recursos profissionais por mais ${days} ${days === 1 ? 'dia' : 'dias'}. Ao final, sua conta volta ao básico.`;
  }

  if (accessState?.hasActiveProAccess) {
    if (isPlanExpiringSoon(accessState.planExpiresAt)) {
      return 'Renove agora para continuar com análises, encaminhamentos e guias sem interrupções.';
    }

    return 'Sua conta segue com avaliações completas, encaminhamentos com IA, guias de prescrição e templates próprios liberados.';
  }

  if (accessState?.isTrialExpired) {
    return `A organização básica continua liberada. Assine a partir de ${PRO_PLAN_PRICE_COPY} ${PRO_PLAN_PERIOD_COPY} para recuperar os recursos profissionais.`;
  }

  if (accessState?.billingStatus === 'expired') {
    return `A organização básica continua liberada. Reative o profissional a partir de ${PRO_PLAN_PRICE_COPY} ${PRO_PLAN_PERIOD_COPY} para recuperar os recursos Pro.`;
  }

  return `A organização básica continua liberada. Assine a partir de ${PRO_PLAN_PRICE_COPY} ${PRO_PLAN_PERIOD_COPY} para usar IA, encaminhamentos, guias e templates próprios.`;
}

function getTrialUsageRows(trialUsage) {
  if (!trialUsage?.limits || !trialUsage?.remaining) {
    return [];
  }

  return [
    ['Avaliações completas', 'insights'],
    ['Encaminhamentos', 'referralLetters'],
    ['Guias de prescrição', 'prescriptionGuides'],
    ['Templates próprios', 'userTemplates'],
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
            <p>{'Centralize informações da sua conta, plano, preferências de uso e orientações de privacidade em um só lugar.'}</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            {'Aqui você poderá acompanhar o plano atual, preferências de uso, privacidade e futuros recursos pessoais do produto.'}
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
  const showExpiringSoon = accessState?.hasActiveProAccess && isPlanExpiringSoon(accessState?.planExpiresAt);
  const trialRows = accessState?.isTrialAccess ? getTrialUsageRows(trialUsage || profile?.trial_usage) : [];
  const shouldShowUpgradeAction = !accessState?.hasActiveProAccess || accessState?.isTrialAccess;

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>{'Centralize sua conta, plano, preferências de uso e orientações de privacidade em uma área simples e confiável.'}</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>{'Informações básicas de acesso ao produto.'}</p>
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
              <p>{'Resumo do acesso atual com status real de ativação e validade.'}</p>
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
                          ? `Reativar por ${PRO_PLAN_PRICE_COPY}`
                          : `Assinar por ${PRO_PLAN_PRICE_COPY}`}
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
              <h2>{'Preferências'}</h2>
              <p>Estrutura inicial para personalizar o uso do produto ao longo do tempo.</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>Template padrão recente</span>
                <strong>{selectedTemplateName || 'Ainda não definido'}</strong>
              </div>
              <div className="profile-info-row">
                <span>Painel contextual</span>
                <strong>{getSidebarPreferenceLabel(activeSidebarTab)}</strong>
              </div>
              <div className="profile-info-row">
                <span>Recursos básicos</span>
                <strong>Organização da anamnese liberada</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>{'Privacidade'}</h2>
              <p>{'Comunicação clara sobre como usar o produto com mais segurança.'}</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">{'Evite inserir dados identificáveis do paciente no texto.'}</div>
              <div className="profile-privacy-item">{'O texto é processado por IA para gerar organização, análises e encaminhamentos.'}</div>
              <div className="profile-privacy-item">{'O produto não salva o texto como prontuário; métricas agregadas de uso e evolução podem ser registradas.'}</div>
              <div className="profile-privacy-item">{'Espaço preparado para política de privacidade e controles adicionais no futuro.'}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
