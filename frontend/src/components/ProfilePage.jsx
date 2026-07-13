import { PRO_PLAN_PERIOD_COPY, PRO_PLAN_PRICE_COPY } from '../billingPlans';

function formatPlanExpiry(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('pt-BR');
}

function formatCurrencyBRL(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value) || 0);
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

const PLAN_KEY_LABELS = {
  monthly: 'Plano mensal',
  semiannual: 'Plano semestral',
};

const CONTEXTUAL_TAB_OPTIONS = [
  { value: 'guide', label: 'Guia clínico' },
  { value: 'calculator', label: 'Calculadoras' },
];

function getContextualTabLabel(value) {
  return CONTEXTUAL_TAB_OPTIONS.find((option) => option.value === value)?.label || 'Guia clínico';
}

function getPlanLabel(accessState) {
  if (accessState?.isAffiliate) {
    return 'Afiliado';
  }

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
  if (accessState?.isAffiliate) {
    return 'Acesso ao programa de afiliados liberado.';
  }

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
  if (accessState?.isAffiliate) {
    return 'Você pode acessar a área de afiliados, gerar seu link de indicação e acompanhar comissões registradas.';
  }

  if (accessState?.isTrialAccess) {
    const days = accessState.trialDaysRemaining || 1;
    return `Você está com acesso completo aos recursos profissionais por mais ${days} ${days === 1 ? 'dia' : 'dias'}. Ao final, sua conta volta ao básico.`;
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

function PlanActions({
  accessState,
  shouldShowUpgradeAction,
  loadingCheckout,
  checkoutError,
  onUpgrade,
  onRequestCancelSubscription,
  justCancelledAccessUntil,
  justCancelledRefund,
}) {
  if (shouldShowUpgradeAction) {
    return (
      <>
        <button type="button" className="btn btn-primario" onClick={onUpgrade} disabled={loadingCheckout}>
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
    );
  }

  if (justCancelledRefund) {
    const refundLabel = justCancelledRefund.amount != null
      ? formatCurrencyBRL(justCancelledRefund.amount, justCancelledRefund.currencyId)
      : '';
    return (
      <div className="profile-plan-note">
        <span>Reembolso solicitado</span>
        <strong>
          {refundLabel
            ? `Estorno de ${refundLabel} em processamento na Mercado Pago. Seu acesso profissional foi encerrado.`
            : 'Estorno em processamento na Mercado Pago. Seu acesso profissional foi encerrado.'}
        </strong>
      </div>
    );
  }

  if (justCancelledAccessUntil) {
    return (
      <div className="profile-plan-note">
        <span>Assinatura cancelada</span>
        <strong>{`Você não será cobrado novamente. Seu acesso continua até ${formatPlanExpiry(justCancelledAccessUntil)}.`}</strong>
      </div>
    );
  }

  if (accessState?.hasActiveRecurringSubscription) {
    return (
      <button type="button" className="btn btn-secundario" onClick={onRequestCancelSubscription}>
        {accessState?.refundWindow?.eligible ? 'Cancelar e solicitar reembolso' : 'Cancelar assinatura'}
      </button>
    );
  }

  // Compra sem recorrência (semestral) mas dentro do prazo de arrependimento:
  // permite o cancelamento com estorno integral.
  if (accessState?.refundWindow?.eligible) {
    return (
      <button type="button" className="btn btn-secundario" onClick={onRequestCancelSubscription}>
        Solicitar reembolso (7 dias)
      </button>
    );
  }

  // Sem ação self-service (afiliado, semestral fora do prazo) — sem botão.
  return null;
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
  onRequestCancelSubscription,
  justCancelledAccessUntil,
  justCancelledRefund,
  onUpdateContextualTab,
  savingPreference,
  onExportData,
  exportingData,
  exportError,
  onRequestDeleteAccount,
}) {
  if (!user) {
    return (
      <div className="profile-page">
        <section className="workspace-surface profile-hero">
          <div className="profile-hero-copy">
            <span className="workspace-kicker">Conta</span>
            <h1>Seu perfil</h1>
            <p>{'Centralize informações da sua conta, plano, preferências de uso e privacidade em um só lugar.'}</p>
          </div>
        </section>

        <section className="profile-empty-state">
          <strong>Entre na sua conta para acessar seu perfil.</strong>
          <span>
            {'Aqui você acompanha o plano atual, cobrança, preferências de uso e controles de privacidade da sua conta.'}
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
  const shouldShowUpgradeAction =
    (!accessState?.hasActiveProAccess || accessState?.isTrialAccess) && !accessState?.isAffiliate;
  const subscription = accessState?.subscription || null;
  const currentContextualTab = CONTEXTUAL_TAB_OPTIONS.some((option) => option.value === activeSidebarTab)
    ? activeSidebarTab
    : 'guide';

  return (
    <div className="profile-page">
      <section className="workspace-surface profile-hero">
        <div className="profile-hero-copy">
          <span className="workspace-kicker">Conta</span>
          <h1>Seu perfil</h1>
          <p>{'Gerencie seu plano, cobrança, preferências de uso e privacidade em uma área simples e confiável.'}</p>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card profile-card-highlight">
            <div className="profile-card-header">
              <h2>Plano e cobrança</h2>
              <p>{'Status real do seu acesso e da assinatura.'}</p>
            </div>

            <div className="profile-plan-card">
              <span className={`profile-plan-badge ${accessState?.hasActiveProAccess ? 'pro' : 'free'}`}>{planLabel}</span>
              {showExpiringSoon ? (
                <span className="profile-plan-alert">Seu acesso profissional termina em breve</span>
              ) : null}
              <strong>{planSummary}</strong>
              <p>{getPlanDescription(accessState)}</p>

              {subscription ? (
                <div className="profile-billing-details">
                  <div>
                    <span>Plano</span>
                    <strong>{PLAN_KEY_LABELS[subscription.planKey] || 'Assinatura recorrente'}</strong>
                  </div>
                  {subscription.amount != null ? (
                    <div>
                      <span>Valor</span>
                      <strong>{formatCurrencyBRL(subscription.amount, subscription.currencyId)}/mês</strong>
                    </div>
                  ) : null}
                  {subscription.nextPaymentDate ? (
                    <div>
                      <span>Próxima cobrança</span>
                      <strong>{formatPlanExpiry(subscription.nextPaymentDate)}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {accessState?.isTrialAccess ? (
                <div className="profile-plan-note">
                  <span>Teste profissional</span>
                  <strong>Acesso completo liberado durante o período gratuito.</strong>
                </div>
              ) : null}
            </div>

            <div className="profile-card-actions">
              <PlanActions
                accessState={accessState}
                shouldShowUpgradeAction={shouldShowUpgradeAction}
                loadingCheckout={loadingCheckout}
                checkoutError={checkoutError}
                onUpgrade={onUpgrade}
                onRequestCancelSubscription={onRequestCancelSubscription}
                justCancelledAccessUntil={justCancelledAccessUntil}
                justCancelledRefund={justCancelledRefund}
              />
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Conta</h2>
              <p>{'Seus dados de acesso e controles da conta.'}</p>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>E-mail</span>
                <strong>{profileEmail}</strong>
              </div>
            </div>

            <div className="profile-card-actions profile-card-actions-stack">
              <div className="profile-inline-actions">
                <button type="button" className="btn btn-secundario" onClick={onExportData} disabled={exportingData}>
                  {exportingData ? 'Exportando...' : 'Exportar meus dados'}
                </button>
                <button type="button" className="btn btn-secundario" onClick={onSignOut}>
                  Sair
                </button>
              </div>
              {exportError ? <div className="topbar-auth-error">{exportError}</div> : null}
            </div>

            <div className="profile-danger-zone">
              <div>
                <strong>Excluir minha conta</strong>
                <span>Apaga seu perfil e histórico de anamneses de forma permanente.</span>
              </div>
              <button type="button" className="btn btn-perigo-outline" onClick={onRequestDeleteAccount}>
                Excluir conta
              </button>
            </div>
          </section>
        </div>

        <div className="profile-column">
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>{'Preferências'}</h2>
              <p>Personalize como o produto se comporta no seu fluxo.</p>
            </div>

            <div className="profile-pref-list">
              <div className="profile-pref-row">
                <div>
                  <span>Painel contextual padrão</span>
                  <small>Qual aba aparece primeiro no apoio lateral.</small>
                </div>
                <select
                  className="profile-pref-select"
                  value={currentContextualTab}
                  onChange={(event) => onUpdateContextualTab?.(event.target.value)}
                  disabled={savingPreference}
                >
                  {CONTEXTUAL_TAB_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="profile-info-row">
                <span>Template padrão recente</span>
                <strong>{selectedTemplateName || 'Ainda não definido'}</strong>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-header">
              <h2>{'Privacidade e termos'}</h2>
              <p>{'Como usar o produto com segurança e onde ler as regras completas.'}</p>
            </div>

            <div className="profile-privacy-list">
              <div className="profile-privacy-item">{'Evite inserir dados identificáveis do paciente no texto.'}</div>
              <div className="profile-privacy-item">{'O texto é processado por IA para gerar organização, análises e encaminhamentos, e não é salvo como prontuário.'}</div>
            </div>

            <div className="profile-legal-links">
              <a href="/privacidade">Política de Privacidade</a>
              <a href="/termos">Termos de Uso</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
