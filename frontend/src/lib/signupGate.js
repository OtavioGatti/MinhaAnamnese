// Cadastro como porta de entrada: "Organizar anamnese" com conta e celular para
// contato. Lógica pura, testada em backend/tests/signupGate.test.js; o App só
// lê e grava o armazenamento.

// --- organizar só com conta ---------------------------------------------------

// Liga a trava só neste navegador, para testar em produção antes de abrir para
// todo mundo: ?exigir_login=1 liga, ?exigir_login=0 desliga.
export const ORGANIZE_LOGIN_OVERRIDE_KEY = 'minha-anamnese:exigir-login';
const PARAMETRO_DE_TESTE = 'exigir_login';

export function resolveOrganizeLoginRequired({ flag, search = '', stored = null }) {
  const parametro = new URLSearchParams(search).get(PARAMETRO_DE_TESTE);
  let guardado = stored === '1' ? '1' : null;

  if (parametro === '1') {
    guardado = '1';
  } else if (parametro === '0') {
    guardado = null;
  }

  return {
    required: flag === 'on' || flag === 'true' || guardado === '1',
    stored: guardado,
  };
}

// Quem clicou em Organizar sem conta: o texto já fica no rascunho do
// navegador; a marca serve para, na volta do e-mail de confirmação, avisar que
// ele continua ali. Vale 3 dias — depois disso o aviso seria estranho.
export const PENDING_ORGANIZE_KEY = 'minha-anamnese:organizar-pendente';
const PENDING_ORGANIZE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function isPendingOrganizeValid(stored, now = Date.now()) {
  const marca = Number(stored);
  return Number.isFinite(marca) && marca > 0 && marca <= now && now - marca < PENDING_ORGANIZE_TTL_MS;
}

// --- celular de quem já tinha conta ------------------------------------------

// Quem se cadastrou antes do campo existir é convidado a informar o celular ao
// organizar. Dá para adiar duas vezes; depois o organizar pede o número.
// Assinante e afiliado podem sempre adiar: nunca travar quem paga.
export const PHONE_PROMPT_MAX_SKIPS = 2;

export function phonePromptSkipKey(userId) {
  return `minha-anamnese:celular-adiado:${userId}`;
}

export function shouldAskForPhone({ userId, profile, suppressed = false }) {
  return Boolean(userId && profile && !profile.phone && !suppressed);
}

export function canSkipPhonePrompt({ skipCount = 0, accessState = null }) {
  if (accessState?.isPaidProAccess || accessState?.isAffiliate) {
    return true;
  }

  return (Number(skipCount) || 0) < PHONE_PROMPT_MAX_SKIPS;
}
