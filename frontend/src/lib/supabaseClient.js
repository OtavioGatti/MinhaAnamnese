import { createClient } from '@supabase/supabase-js';

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

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createFallbackSupabaseClient();

export { isSupabaseConfigured };
export default supabase;
