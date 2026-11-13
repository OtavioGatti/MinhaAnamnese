import { useEffect, useRef } from 'react';

// Banner de cookies: uma faixa curta no rodapé, com "Recusar" e "Aceitar" lado a
// lado e com o mesmo destaque. Fica acima das janelas (termos, planos) para que
// a pessoa consiga responder no meio do cadastro.
//
// Enquanto ele está na tela, a altura dele vira --cookie-banner-space no <html>
// (classe has-cookie-banner): a página e as janelas ganham essa folga embaixo,
// e nada fica coberto sem saída — nem o formulário de cadastro, nem os botões
// das janelas.
//
// O texto cita Meta e Google porque o aceite liga os dois (Pixel na vitrine,
// Analytics e tag do Ads). Mudar o texto sem mudar as finalidades NÃO pede subir
// COOKIE_CONSENT_VERSION (App.jsx): subir reabre o banner para todo mundo.
function CookieConsentBanner({ visible, onAccept, onReject }) {
  const bannerRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    const node = bannerRef.current;

    if (!visible || !node) {
      return undefined;
    }

    const update = () => {
      root.style.setProperty('--cookie-banner-space', `${Math.ceil(node.getBoundingClientRect().height) + 16}px`);
    };

    root.classList.add('has-cookie-banner');
    update();

    let observer = null;

    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(update);
      observer.observe(node);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      root.classList.remove('has-cookie-banner');
      root.style.removeProperty('--cookie-banner-space');
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <aside ref={bannerRef} className="cookie-consent-banner" aria-label="Preferências de cookies">
      <p className="cookie-consent-copy">
        Com o seu aceite, usamos cookies da Meta e do Google para medir o uso do site e quais anúncios trazem
        pessoas até aqui. Nada do que você escreve no atendimento é compartilhado.{' '}
        <a href="/privacidade">Política de Privacidade</a>
      </p>

      <div className="cookie-consent-actions">
        <button type="button" className="btn cookie-consent-choice" onClick={onReject}>
          Recusar
        </button>
        <button type="button" className="btn cookie-consent-choice" onClick={onAccept}>
          Aceitar
        </button>
      </div>
    </aside>
  );
}

export default CookieConsentBanner;
