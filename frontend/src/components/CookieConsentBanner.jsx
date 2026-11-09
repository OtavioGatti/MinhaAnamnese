function CookieConsentBanner({ visible, onAccept, onReject }) {
  if (!visible) {
    return null;
  }

  return (
    <aside className="cookie-consent-banner" aria-label="Preferências de cookies">
      <div className="cookie-consent-copy">
        <strong>Privacidade e cookies</strong>
        <p>
          Usamos cookies essenciais para login e segurança. Com o seu aceite, usamos também cookies de medição de uso
          (Google) e de medição e publicidade da Meta, para saber se os nossos anúncios funcionam. O Pixel da Meta não
          roda na área logada e não recebe dado clínico. Você pode aceitar ou recusar.
        </p>
        <a href="/privacidade">Ler Política de Privacidade</a>
      </div>

      <div className="cookie-consent-actions">
        <button type="button" className="btn btn-secundario" onClick={onReject}>
          Recusar não essenciais
        </button>
        <button type="button" className="btn btn-primario" onClick={onAccept}>
          Aceitar cookies
        </button>
      </div>
    </aside>
  );
}

export default CookieConsentBanner;
