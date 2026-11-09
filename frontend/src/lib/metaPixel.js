// Pixel do Meta (conjunto de dados "Minha Anamnese – Site").
//
// O conjunto está categorizado como "Saúde e bem-estar" e o workspace logado é
// onde circulam anamneses, hipóteses e prescrições. Por isso este módulo tem
// duas metades que não se misturam:
//
// 1. O script oficial (fbevents.js) só existe na vitrine: visitante SEM conta
//    logada, na home ou nas páginas legais. Quem decide é o App.jsx, que chama
//    enableMetaPixel/disableMetaPixel. Ao sair da vitrine (login, bulário,
//    ferramentas...) o script e o `fbq` são removidos da página.
//
// 2. O pagamento aprovado (Subscribe) acontece com a pessoa já logada. Ele sai
//    por uma requisição de imagem ao endpoint do Pixel, SEM carregar o script:
//    o Meta recebe só o nome do evento, o valor e os identificadores de
//    clique/navegador que o próprio Pixel gravou na vitrine (_fbp/_fbc, lidos
//    dos cookies e mandados na URL — cookie do nosso domínio não vai sozinho
//    para facebook.com), nunca o endereço real da página nem nada da tela.
//
// O cadastro (CompleteRegistration) sai no envio do formulário, ainda na
// vitrine, pelo próprio fbq — ver trackMetaCompleteRegistration.
//
// Sem correspondência avançada: nenhum e-mail, nome, telefone ou id de usuário
// sai daqui. A detecção automática (cliques em botão, metadados da página) e o
// PageView automático por pushState também ficam desligados.
//
// Segue o consentimento de cookies como o resto do tracking, e sem
// VITE_META_PIXEL_ID configurada tudo aqui vira no-op.
import { isTrackingEnvironment } from './gtag';

const RAW_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || '').trim();
const PIXEL_ID = /^\d{5,20}$/.test(RAW_PIXEL_ID) ? RAW_PIXEL_ID : '';
const SCRIPT_ID = 'meta-pixel-script';
const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const EVENT_ENDPOINT = 'https://www.facebook.com/tr';
const REGISTRATION_KEY = 'minha-anamnese-meta-registration';
const SUBSCRIBE_KEY = 'minha-anamnese-meta-subscribe';

let active = false;

function isAvailable() {
  return Boolean(PIXEL_ID) && typeof window !== 'undefined' && isTrackingEnvironment();
}

// Link de confirmação/recuperação volta com token no endereço. O fbevents.js
// manda o endereço inteiro da página; com token nele, o Pixel não sobe.
function urlCarriesSecret() {
  const { search, hash } = window.location;
  return /access_token|refresh_token|token_hash|[?&#]code=|[?&#]token=|type=recovery/i.test(`${search}${hash}`);
}

export function isMetaPixelActive() {
  return active;
}

// Carrega o script oficial uma única vez por "entrada na vitrine".
export function enableMetaPixel() {
  if (!isAvailable() || urlCarriesSecret()) {
    return false;
  }

  if (active) {
    return true;
  }

  // Mesmo stub do snippet oficial: enfileira os comandos até o script chegar.
  const fbq = function fbqStub() {
    // eslint-disable-next-line prefer-rest-params
    const args = arguments;

    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      fbq.queue.push(args);
    }
  };

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  // Navegação é SPA e reportada à mão (trackMetaPageView): sem isto o script
  // dispararia PageView sozinho em qualquer pushState.
  fbq.disablePushState = true;

  window.fbq = fbq;
  window._fbq = fbq;

  // Antes do init: sem eventos automáticos de clique nem leitura de metadados.
  fbq('set', 'autoConfig', false, PIXEL_ID);
  fbq('init', PIXEL_ID);

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);

  active = true;
  return true;
}

// Saiu da vitrine: o Pixel deixa de existir na página.
export function disableMetaPixel() {
  if (!active) {
    return;
  }

  active = false;
  document.getElementById(SCRIPT_ID)?.remove();

  try {
    delete window.fbq;
    delete window._fbq;
  } catch {
    window.fbq = undefined;
    window._fbq = undefined;
  }
}

export function trackMetaPageView() {
  if (!active || typeof window.fbq !== 'function' || urlCarriesSecret()) {
    return false;
  }

  window.fbq('track', 'PageView');
  return true;
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// Conversão sem script: uma imagem de 1 px para o endpoint do Pixel.
function sendConversion(eventName, customData = {}) {
  const params = new URLSearchParams();
  params.set('id', PIXEL_ID);
  params.set('ev', eventName);
  // Endereço fixo de propósito: nunca o da tela em que a pessoa está.
  params.set('dl', `${window.location.origin}/`);
  params.set('ts', String(Date.now()));

  const fbp = readCookie('_fbp');
  const fbc = readCookie('_fbc');

  if (fbp) {
    params.set('fbp', fbp);
  }

  if (fbc) {
    params.set('fbc', fbc);
  }

  Object.entries(customData).forEach(([key, value]) => {
    params.set(`cd[${key}]`, String(value));
  });

  const image = new Image(1, 1);
  image.referrerPolicy = 'no-referrer';
  image.src = `${EVENT_ENDPOINT}?${params.toString()}`;
}

function readStored(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento: o ponto de disparo já é único por fluxo.
  }
}

// Cadastro ENVIADO com sucesso, não o e-mail confirmado: o link de confirmação
// costuma abrir em outro navegador (app de e-mail), sem os cookies do Pixel e
// sem o aceite de cookies, e a conversão ficaria sem anúncio de origem. No
// envio a pessoa ainda é visitante sem sessão, na vitrine, com o Pixel já
// carregado — por isso sai pelo próprio fbq, e só se ele estiver ativo.
//
// Uma vez por cadastro: `signupId` (id que o signUp devolve) só serve para a
// trava local e não é enviado. Nenhum parâmetro vai junto do evento.
export function trackMetaCompleteRegistration(signupId) {
  if (!active || typeof window.fbq !== 'function' || urlCarriesSecret()) {
    return false;
  }

  const dedupeKey = String(signupId || '');

  if (dedupeKey && readStored(REGISTRATION_KEY) === dedupeKey) {
    return false;
  }

  if (dedupeKey) {
    remember(REGISTRATION_KEY, dedupeKey);
  }

  window.fbq('track', 'CompleteRegistration');
  return true;
}

// Pagamento aprovado e confirmado na própria página. `reference` (pedido ou
// assinatura) só evita o disparo repetido; não é enviado.
export function trackMetaSubscribe({ value, reference, consent = false } = {}) {
  const amount = Math.round(Number(value) * 100) / 100;

  if (!consent || !isAvailable() || !(amount > 0)) {
    return false;
  }

  const dedupeKey = String(reference || '');

  if (dedupeKey && readStored(SUBSCRIBE_KEY) === dedupeKey) {
    return false;
  }

  if (dedupeKey) {
    remember(SUBSCRIBE_KEY, dedupeKey);
  }

  sendConversion('Subscribe', { value: amount.toFixed(2), currency: 'BRL' });
  return true;
}
