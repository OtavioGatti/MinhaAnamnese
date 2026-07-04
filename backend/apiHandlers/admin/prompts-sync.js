const {
  isNotionPromptSyncConfigured,
  syncNotionPrompts,
} = require('../../services/notionPromptSync');
const {
  consumeRateLimit,
  sendRateLimitResponse,
} = require('../../utils/rateLimit');

const SYNC_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

function getHeaderValue(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function getBearerToken(req) {
  const authorization = getHeaderValue(req, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getSyncSecretFromRequest(req) {
  return getHeaderValue(req, 'x-prompt-sync-secret').trim() ||
    getHeaderValue(req, 'x-template-sync-secret').trim() ||
    getBearerToken(req);
}

function getExpectedSyncSecret() {
  return process.env.PROMPT_SYNC_SECRET ||
    process.env.TEMPLATE_SYNC_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    '';
}

function isAuthorizedSyncRequest(req) {
  const expectedSecret = getExpectedSyncSecret();
  const providedSecret = getSyncSecretFromRequest(req);

  return Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'prompts_sync',
    limit: SYNC_RATE_LIMIT.limit,
    windowMs: SYNC_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!getExpectedSyncSecret()) {
    return res.status(503).json({
      success: false,
      error: 'Sincronizacao de prompts nao configurada.',
    });
  }

  if (!isAuthorizedSyncRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso nao autorizado.',
    });
  }

  if (!isNotionPromptSyncConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Integracao Notion -> Supabase dos prompts nao configurada.',
    });
  }

  let result;
  try {
    result = await syncNotionPrompts();
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const responseBody = String(error?.responseBody || '');
    const isNotionAccessError = responseBody.includes('Could not find database')
      || responseBody.includes('shared with your integration')
      || responseBody.includes('object_not_found');

    if (isNotionAccessError) {
      return res.status(502).json({
        success: false,
        error: 'A integracao do Notion usada pelo backend nao tem acesso a tabela de Prompts.',
        details: responseBody.slice(0, 1000),
      });
    }

    if (responseBody.includes('duplicate_published_prompt_scope_in_notion')) {
      let duplicateDetails = responseBody;
      try {
        duplicateDetails = JSON.parse(responseBody);
      } catch (_parseError) {
        // Mantem texto bruto se a resposta nao estiver em JSON.
      }

      return res.status(409).json({
        success: false,
        error: 'Existem prompts publicados duplicados no Notion para o mesmo escopo.',
        details: duplicateDetails,
      });
    }

    if (responseBody.includes('duplicate_published_prompt_scope_in_supabase')) {
      let conflictDetails = responseBody;
      try {
        conflictDetails = JSON.parse(responseBody);
      } catch (_parseError) {
        // Mantem texto bruto se a resposta nao estiver em JSON.
      }

      return res.status(409).json({
        success: false,
        error: 'Existem prompts publicados duplicados no Supabase para o mesmo escopo.',
        details: conflictDetails,
      });
    }

    if (
      responseBody.includes('official_prompts_published_type_category_uidx') ||
      responseBody.includes('duplicate key value violates unique constraint')
    ) {
      return res.status(409).json({
        success: false,
        error: 'O Supabase recusou prompts publicados duplicados para o mesmo prompt_type/category_key.',
        details: responseBody.slice(0, 1000),
      });
    }

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: 'Falha ao sincronizar Prompts.',
      details: responseBody.slice(0, 1000) || error?.message || 'Erro desconhecido',
    });
  }

  return res.status(200).json({
    success: true,
    data: result,
  });
};
