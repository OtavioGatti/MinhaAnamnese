// Google Analytics (GA4) via gtag.js. Só carrega depois que o usuário aceita
// cookies não essenciais no CookieConsentBanner — mesma regra que já vale para
// o analytics próprio do app (ver canTrackNonEssentialCookies em App.jsx).
// Sem VITE_GA_MEASUREMENT_ID configurada, tudo aqui vira no-op.
import { ensureGtagLoaded, isGtagReady } from './gtag';

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

let configured = false;

export function initGoogleAnalytics() {
  if (configured || !ensureGtagLoaded(MEASUREMENT_ID)) {
    return;
  }

  configured = true;

  // send_page_view desligado aqui: a navegação é SPA (troca de tela sem
  // recarregar), então cada "página" é reportada manualmente via
  // trackGoogleAnalyticsPageView, chamada a cada mudança de tela.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
}

export function trackGoogleAnalyticsPageView(pagePath, pageTitle) {
  if (!configured || !isGtagReady()) {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}
