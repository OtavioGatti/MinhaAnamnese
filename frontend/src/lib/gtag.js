// Carregador compartilhado do gtag.js.
//
// GA4 (analytics) e Google Ads (conversão) usam o MESMO script e o MESMO
// dataLayer — injetar a tag duas vezes duplicaria eventos. Quem inicializar
// primeiro carrega o script; os demais só empilham o próprio `config`.
let scriptRequested = false;

// Mesma trava do analytics próprio do app: localhost não polui os dados reais.
export function isTrackingEnvironment() {
  return window.location.hostname !== 'localhost';
}

// Devolve true quando o gtag está disponível para receber comandos.
export function ensureGtagLoaded(tagId) {
  if (!tagId || !isTrackingEnvironment()) {
    return false;
  }

  if (scriptRequested) {
    return true;
  }

  scriptRequested = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  window.gtag('js', new Date());

  return true;
}

export function isGtagReady() {
  return scriptRequested && typeof window.gtag === 'function';
}
