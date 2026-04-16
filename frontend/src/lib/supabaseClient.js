const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STORAGE_KEY = 'minha-anamnese-supabase-session';

const listeners = new Set();

function canUseBrowserApis() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function getStoredSession() {
  if (!canUseBrowserApis()) {
    return null;
  }

  const rawSession = localStorage.getItem(STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function setStoredSession(session) {
  if (!canUseBrowserApis()) {
    return;
  }

  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function notify(event, session) {
  listeners.forEach((callback) => callback(event, session));
}

async function fetchUser(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch user');
  }

  return response.json();
}

async function recoverSessionFromUrl() {
  if (!canUseBrowserApis() || !window.location.hash) {
    return getStoredSession();
  }

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const expiresIn = Number(hashParams.get('expires_in') || 0);
  const tokenType = hashParams.get('token_type');
  const type = hashParams.get('type');

  if (!accessToken || !refreshToken) {
    return getStoredSession();
  }

  const user = await fetchUser(accessToken);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_in: expiresIn,
    expires_at: expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null,
    user,
    type,
  };

  setStoredSession(session);
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  notify('SIGNED_IN', session);

  return session;
}

async function getSession() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      data: { session: null },
      error: new Error('Supabase environment variables are not configured'),
    };
  }

  try {
    const session = await recoverSessionFromUrl();
    return {
      data: { session },
      error: null,
    };
  } catch (error) {
    setStoredSession(null);
    return {
      data: { session: null },
      error,
    };
  }
}

async function signInWithOtp({ email, options = {} }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      data: null,
      error: new Error('Supabase environment variables are not configured'),
    };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        create_user: true,
        options: {
          emailRedirectTo: options.emailRedirectTo,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.msg || 'Unable to send magic link');
    }

    return {
      data: await response.json().catch(() => ({})),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error,
    };
  }
}

async function signOut() {
  setStoredSession(null);
  notify('SIGNED_OUT', null);

  return {
    error: null,
  };
}

function onAuthStateChange(callback) {
  listeners.add(callback);

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          listeners.delete(callback);
        },
      },
    },
  };
}

export const supabase = {
  auth: {
    getSession,
    signInWithOtp,
    signOut,
    onAuthStateChange,
  },
};

export default supabase;
