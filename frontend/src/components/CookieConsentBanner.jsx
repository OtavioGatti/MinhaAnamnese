function CookieConsentBanner({ visible, onAccept, onReject }) {
  if (!visible) {
    return null;
  }

  return (
    <aside className="cookie-consent-banner" aria-label="Preferências de cookies">
      <div className="cookie-consent-copy">
        <strong>Privacidade e cookies</strong>
        <p>
          Usamos cookies essenciais para login e segurança. Cookies não essenciais ajudam a medir uso e melhorar estabilidade.
          Você pode aceitar ou recusar métricas não essenciais.
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
