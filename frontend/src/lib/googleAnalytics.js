// Google Analytics (GA4) via gtag.js. Só carrega depois que o usuário aceita
// cookies não essenciais no CookieConsentBanner — mesma regra que já vale para
// o analytics próprio do app (ver canTrackNonEssentialCookies em App.jsx).
// Sem VITE_GA_MEASUREMENT_ID configurada, tudo aqui vira no-op.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

let loaded = false;

function isTrackingEnvironment() {
  return Boolean(MEASUREMENT_ID) && window.location.hostname !== 'localhost';
}

export function initGoogleAnalytics() {
  if (loaded || !isTrackingEnvironment()) {
    return;
  }

  loaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  window.gtag('js', new Date());
  // send_page_view desligado aqui: a navegação é SPA (troca de tela sem
  // recarregar), então cada "página" é reportada manualmente via
  // trackGoogleAnalyticsPageView, chamada a cada mudança de tela.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

export function trackGoogleAnalyticsPageView(pagePath, pageTitle) {
  if (!loaded || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}
