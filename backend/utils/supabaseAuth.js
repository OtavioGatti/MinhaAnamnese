function getSupabaseAuthConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    anonKey,
  };
}

function getAccessTokenFromRequest(req) {
  const authorizationHeader =
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    '';

  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function resolveSupabaseUser(req) {
  const accessToken = getAccessTokenFromRequest(req);

  if (!accessToken) {
    return {
      user: null,
      error: 'Autenticação obrigatória.',
      statusCode: 401,
    };
  }

  const { url, anonKey } = getSupabaseAuthConfig();

  if (!url || !anonKey) {
    return {
      user: null,
      error: 'Não foi possível validar sua sessão no momento.',
      statusCode: 401,
    };
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return {
        user: null,
        error: 'Autenticação obrigatória.',
        statusCode: 401,
      };
    }

    const user = await response.json();

    if (!user?.id) {
      return {
        user: null,
        error: 'Autenticação obrigatória.',
        statusCode: 401,
      };
    }

    return {
      user,
      error: null,
      statusCode: 200,
    };
  } catch (_error) {
    return {
      user: null,
      error: 'Não foi possível validar a sessão.',
      statusCode: 401,
    };
  }
}

function hasProPlan(user) {
  return user?.user_metadata?.plan === 'pro';
}

module.exports = {
  getAccessTokenFromRequest,
  hasProPlan,
  resolveSupabaseUser,
};
