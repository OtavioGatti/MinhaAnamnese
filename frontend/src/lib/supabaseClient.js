import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
