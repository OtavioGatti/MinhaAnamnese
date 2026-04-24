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

function CheckoutSuccessBanner({
  isExpiringSoon,
  planExpiresAt,
  onDismiss,
  onViewAnalysis,
  onGoProfile,
}) {
  const expiryLabel = formatPlanExpiry(planExpiresAt);

  return (
    <section className="checkout-success-banner workspace-surface" aria-live="polite">
      <div className="checkout-success-copy">
        <span className="workspace-kicker">Pagamento aprovado</span>
        <h2>Plano profissional ativado com sucesso</h2>
        <p>Sua conta já está com acesso completo liberado.</p>

        <ul className="checkout-success-list">
          <li>análise completa dos casos</li>
          <li>próximo passo clínico</li>
          <li>evolução do seu histórico</li>
          <li>{expiryLabel ? `acesso profissional por 30 dias até ${expiryLabel}` : 'acesso profissional por 30 dias'}</li>
        </ul>

        {isExpiringSoon ? (
          <div className="checkout-success-note">
            Seu acesso profissional termina em breve. Renove a tempo para continuar com análise completa e evolução sem interrupções.
          </div>
        ) : null}
      </div>

      <div className="checkout-success-actions">
        <button type="button" className="btn btn-primario" onClick={onViewAnalysis}>
          Ver minha análise completa
        </button>
        <button type="button" className="btn btn-secundario" onClick={onGoProfile}>
          Ir para Perfil
        </button>
        <button type="button" className="topbar-auth-link" onClick={onDismiss}>
          Fechar
        </button>
      </div>
    </section>
  );
}

export default CheckoutSuccessBanner;
