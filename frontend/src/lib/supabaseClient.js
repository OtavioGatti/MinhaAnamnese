import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_PROBE_TIMEOUT_MS,
  SUPABASE_PROXY_PATH,
  SUPABASE_ROUTE_KEY,
  isSupabaseHealthResponse,
  readStoredRoute,
  serializeStoredRoute,
  toProxyUrl,
} from './supabaseRoute';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const PASSWORD_RECOVERY_PATH = '/redefinir-senha';
const PASSWORD_RECOVERY_INTENT_KEY = 'minha-anamnese-password-recovery-intent';
const SIGNUP_CONFIRMATION_INTENT_KEY = 'minha-anamnese-signup-confirmation-intent';

function rememberPasswordRecoveryIntentFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const authFlow = hashParams.get('auth') || searchParams.get('auth') || '';
    const type = hashParams.get('type') || searchParams.get('type') || '';
    const hasRecoverySignal =
      path === PASSWORD_RECOVERY_PATH ||
      authFlow === 'recovery' ||
      type === 'recovery';

    if (hasRecoverySignal) {
      window.sessionStorage.setItem(PASSWORD_RECOVERY_INTENT_KEY, '1');
    }
  } catch {
    // Ignore storage access errors; the app can still rely on Supabase events.
  }
}

rememberPasswordRecoveryIntentFromUrl();

// Mesma corrida do fluxo de recuperação: o link de confirmação de cadastro traz
// `type=signup` no hash, e o `detectSessionInUrl` do Supabase consome e limpa a
// URL antes do React montar. Por isso o sinal é lido aqui, no carregamento do
// módulo, e guardado para o App consumir depois.
function rememberSignupConfirmationIntentFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get('type') || searchParams.get('type') || '';
    // Link expirado/já usado não vira sessão. Sem este guard o sinal ficaria
    // pendente e um login posterior na mesma aba contaria como conversão.
    const hasError = Boolean(
      hashParams.get('error') ||
        searchParams.get('error') ||
        hashParams.get('error_code') ||
        searchParams.get('error_code')
    );

    if (type === 'signup' && !hasError) {
      window.sessionStorage.setItem(SIGNUP_CONFIRMATION_INTENT_KEY, '1');
    }
  } catch {
    // Ignore storage access errors; the app can still rely on Supabase events.
  }
}

rememberSignupConfirmationIntentFromUrl();

// Consome o sinal (uma vez só) quando já existe sessão: é o momento em que a
// confirmação de cadastro de fato se concretizou.
export function consumeSignupConfirmationIntent() {
  try {
    const hasIntent = window.sessionStorage.getItem(SIGNUP_CONFIRMATION_INTENT_KEY) === '1';

    if (hasIntent) {
      window.sessionStorage.removeItem(SIGNUP_CONFIRMATION_INTENT_KEY);
    }

    return hasIntent;
  } catch {
    return false;
  }
}

function createFallbackSupabaseClient() {
  const unsupportedError = {
    message: 'Supabase n\u00e3o configurado',
  };

  return {
    auth: {
      async getSession() {
        return {
          data: { session: null },
          error: null,
        };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
      async refreshSession() {
        return {
          data: { session: null },
          error: null,
        };
      },
      async signInWithOtp() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async signInWithPassword() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async signUp() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async resetPasswordForEmail() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async updateUser() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async verifyOtp() {
        return {
          data: null,
          error: unsupportedError,
        };
      },
      async signOut() {
        return {
          error: null,
        };
      },
    },
  };
}

// --- caminho até o Supabase (ver supabaseRoute.js) --------------------------

function lerRotaGuardada() {
  try {
    return readStoredRoute(window.localStorage.getItem(SUPABASE_ROUTE_KEY));
  } catch {
    return null;
  }
}

function guardarDesvio() {
  try {
    window.localStorage.setItem(SUPABASE_ROUTE_KEY, serializeStoredRoute());
  } catch {
    // Sem armazenamento, vale só para esta visita.
  }
}

async function comPrazo(executar) {
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), SUPABASE_PROBE_TIMEOUT_MS);

  try {
    return await executar(controle.signal);
  } finally {
    clearTimeout(prazo);
  }
}

// Só saber se o endereço responde: `no-cors` evita que uma recusa de CORS
// pareça bloqueio de rede.
async function supabaseDiretoResponde() {
  try {
    await comPrazo((signal) => fetch(`${supabaseUrl}/auth/v1/health`, { mode: 'no-cors', cache: 'no-store', signal }));
    return true;
  } catch {
    return false;
  }
}

async function atalhoResponde() {
  try {
    return await comPrazo(async (signal) => {
      const resposta = await fetch(`${window.location.origin}${SUPABASE_PROXY_PATH}/auth/v1/health`, {
        cache: 'no-store',
        headers: { apikey: supabaseAnonKey },
        signal,
      });

      return isSupabaseHealthResponse({
        ok: resposta.ok,
        contentType: resposta.headers.get('content-type'),
        body: await resposta.text(),
      });
    });
  } catch {
    return false;
  }
}

let rotaSupabase = typeof window === 'undefined' ? 'direto' : lerRotaGuardada();
let decisaoDaRota = null;

function decidirRota() {
  if (rotaSupabase) {
    return Promise.resolve(rotaSupabase);
  }

  if (!decisaoDaRota) {
    decisaoDaRota = (async () => {
      if (await supabaseDiretoResponde()) {
        rotaSupabase = 'direto';
        return rotaSupabase;
      }

      if (await atalhoResponde()) {
        guardarDesvio();
        rotaSupabase = 'proxy';
        return rotaSupabase;
      }

      // Nem um nem outro: sem internet. Segue direto e decide de novo no
      // próximo pedido.
      decisaoDaRota = null;
      return 'direto';
    })();
  }

  return decisaoDaRota;
}

function pelaRota(input) {
  const origin = window.location.origin;

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Request(toProxyUrl(input.url, { supabaseUrl, origin }), input);
  }

  return toProxyUrl(input, { supabaseUrl, origin });
}

// Todo pedido do cliente do Supabase passa por aqui.
async function fetchSupabase(input, init) {
  if (typeof window === 'undefined') {
    return fetch(input, init);
  }

  if ((await decidirRota()) === 'proxy') {
    return fetch(pelaRota(input), init);
  }

  try {
    return await fetch(input, init);
  } catch (erro) {
    // Rede mudou no meio da visita (ex.: saiu do 4G para um Wi-Fi da operadora
    // que bloqueia). Cancelamento pedido pelo próprio cliente não é bloqueio.
    if (init?.signal?.aborted || !(await atalhoResponde())) {
      throw erro;
    }

    rotaSupabase = 'proxy';
    guardarDesvio();
    return fetch(pelaRota(input), init);
  }
}

// Começa a decidir já no carregamento: quando a pessoa clicar em "Entrar", o
// caminho está pronto.
if (isSupabaseConfigured && typeof window !== 'undefined') {
  decidirRota();
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: fetchSupabase,
      },
    })
  : createFallbackSupabaseClient();

export { isSupabaseConfigured };
export default supabase;
