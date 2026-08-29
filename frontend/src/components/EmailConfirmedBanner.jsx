// Recibo da confirmação de e-mail. Antes, clicar no link do e-mail apenas
// logava a pessoa em silêncio — sem nenhum sinal de que a confirmação
// funcionou. Segue o mesmo formato do CheckoutSuccessBanner (componente burro,
// visibilidade controlada pelo App).

function EmailConfirmedBanner({ email, onDismiss }) {
  return (
    <section className="checkout-success-banner workspace-surface" aria-live="polite">
      <div className="checkout-success-copy">
        <span className="workspace-kicker">E-mail confirmado</span>
        <h2>Sua conta está ativa</h2>
        <p>
          {email
            ? `Confirmamos o e-mail ${email}. Não precisa fazer mais nada — é só começar a usar.`
            : 'Confirmamos seu e-mail. Não precisa fazer mais nada — é só começar a usar.'}
        </p>
      </div>

      <div className="checkout-success-actions">
        <button type="button" className="topbar-auth-link" onClick={onDismiss}>
          Fechar
        </button>
      </div>
    </section>
  );
}

export default EmailConfirmedBanner;
