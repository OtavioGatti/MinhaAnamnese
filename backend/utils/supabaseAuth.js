const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';
const { resolveUserAccessState } = require('../services/accessState');

function logAuthDebug(message, context = {}) {
  if (!DEBUG_AUTH) {
    return;
  }

  console.error('auth:', message, context);
}

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

function getMissingAuthConfigKeys({ url, anonKey }) {
  const missing = [];

  if (!url) {
    missing.push('SUPABASE_URL');
  }

  if (!anonKey) {
    missing.push('SUPABASE_ANON_KEY');
  }

  return missing;
}

async function resolveSupabaseUser(req) {
  const accessToken = getAccessTokenFromRequest(req);

  if (!accessToken) {
    return {
      user: null,
      error: 'Sessão ausente ou expirada. Entre novamente para continuar.',
      statusCode: 401,
    };
  }

  const config = getSupabaseAuthConfig();
  const missingConfigKeys = getMissingAuthConfigKeys(config);

  if (missingConfigKeys.length > 0) {
    logAuthDebug('supabase auth config missing', {
      missingConfigKeys,
    });

    return {
      user: null,
      error: `Autenticação indisponível no servidor: configure ${missingConfigKeys.join(' e ')} no Render.`,
      statusCode: 503,
    };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        user: null,
        error: 'Sessão ausente, inválida ou expirada. Entre novamente para continuar.',
        statusCode: 401,
      };
    }

    if (!response.ok) {
      logAuthDebug('supabase auth validation failed', {
        status: response.status,
      });

      return {
        user: null,
        error: 'Não foi possível validar sua sessão no momento.',
        statusCode: 503,
      };
    }

    const user = await response.json();

    if (!user?.id) {
      return {
        user: null,
        error: 'Sessão ausente, inválida ou expirada. Entre novamente para continuar.',
        statusCode: 401,
      };
    }

    return {
      user,
      error: null,
      statusCode: 200,
    };
  } catch (error) {
    logAuthDebug('supabase auth request threw', {
      message: error?.message || 'unknown_error',
    });

    return {
      user: null,
      error: 'Não foi possível validar sua sessão no momento.',
      statusCode: 503,
    };
  }
}

function hasProPlan(user, profile = null) {
  return resolveUserAccessState({ user, profile }).hasActiveProAccess;
}

module.exports = {
  getAccessTokenFromRequest,
  getSupabaseAuthConfig,
  hasProPlan,
  resolveSupabaseUser,
};
