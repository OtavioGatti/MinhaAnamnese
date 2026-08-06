// Conversão do Google Ads: "cadastro confirmado".
//
// A tag precisa rodar em TODAS as páginas, não só na de conversão: é ela que
// grava o cookie _gcl_aw no primeiro clique vindo do anúncio. A conversão só
// acontece depois (quando a pessoa confirma o e-mail), e é esse cookie que
// permite ao Google ligar as duas coisas. Sem a tag sitewide, a conversão
// dispara mas fica órfã, sem clique de origem.
//
// Segue o consentimento de cookies como o resto do tracking do app, e sem
// VITE_GADS_CONVERSION_ID configurada tudo aqui vira no-op.
import { ensureGtagLoaded, isGtagReady } from './gtag';

const CONVERSION_ID = import.meta.env.VITE_GADS_CONVERSION_ID || '';
const SIGNUP_LABEL = import.meta.env.VITE_GADS_SIGNUP_LABEL || '';
const SIGNUP_CONVERSION_KEY = 'minha-anamnese-signup-conversion';

let configured = false;

export function initGoogleAdsTag() {
  if (configured || !ensureGtagLoaded(CONVERSION_ID)) {
    return;
  }

  configured = true;
  window.gtag('config', CONVERSION_ID);
}

function hasAlreadyConverted(userId) {
  try {
    return localStorage.getItem(SIGNUP_CONVERSION_KEY) === userId;
  } catch {
    return false;
  }
}

function rememberConversion(userId) {
  try {
    localStorage.setItem(SIGNUP_CONVERSION_KEY, userId);
  } catch {
    // Storage indisponível (modo privado/quota): o transaction_id ainda protege
    // contra contagem dupla do lado do Google.
  }
}

// Dispara uma vez por usuário. Guarda dupla de propósito: o localStorage evita
// nem tentar o disparo repetido, e o transaction_id deixa o próprio Google
// deduplicar caso o storage falhe ou o usuário troque de navegador.
export function trackSignupConversion(userId) {
  if (!userId || !SIGNUP_LABEL || !configured || !isGtagReady()) {
    return false;
  }

  if (hasAlreadyConverted(userId)) {
    return false;
  }

  rememberConversion(userId);

  window.gtag('event', 'conversion', {
    send_to: `${CONVERSION_ID}/${SIGNUP_LABEL}`,
    transaction_id: userId,
  });

  return true;
}
