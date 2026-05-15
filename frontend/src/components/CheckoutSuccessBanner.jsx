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
        <p>Sua conta ja esta com acesso completo liberado.</p>

        <ul className="checkout-success-list">
          <li>analise completa dos casos</li>
          <li>encaminhamentos com IA</li>
          <li>protocolos de prescricao e templates proprios</li>
          <li>{expiryLabel ? `acesso profissional garantido ate ${expiryLabel}` : 'acesso profissional por 30 dias'}</li>
        </ul>

        {isExpiringSoon ? (
          <div className="checkout-success-note">
            Seu acesso profissional termina em breve. Renove a tempo para continuar com analise completa e recursos Pro sem interrupcoes.
          </div>
        ) : null}
      </div>

      <div className="checkout-success-actions">
        <button type="button" className="btn btn-primario" onClick={onViewAnalysis}>
          Ver minha analise completa
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
