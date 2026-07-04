const {
  isNotionClinicalToolsSyncConfigured,
  syncNotionClinicalTools,
} = require('../../services/notionClinicalToolsSync');
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
  return getHeaderValue(req, 'x-clinical-tools-sync-secret').trim() ||
    getHeaderValue(req, 'x-ferramentas-sync-secret').trim() ||
    getHeaderValue(req, 'x-template-sync-secret').trim() ||
    getBearerToken(req);
}

function getExpectedSyncSecret() {
  return process.env.CLINICAL_TOOLS_SYNC_SECRET ||
    process.env.FERRAMENTAS_SYNC_SECRET ||
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
      error: 'Método não permitido',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'clinical_tools_sync',
    limit: SYNC_RATE_LIMIT.limit,
    windowMs: SYNC_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!getExpectedSyncSecret()) {
    return res.status(503).json({
      success: false,
      error: 'Sincronização das Ferramentas Clínicas não configurada.',
    });
  }

  if (!isAuthorizedSyncRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado.',
    });
  }

  if (!isNotionClinicalToolsSyncConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Integração Notion -> Supabase das Ferramentas Clínicas não configurada.',
    });
  }

  let result;
  try {
    result = await syncNotionClinicalTools();
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const responseBody = String(error?.responseBody || '');
    const isNotionAccessError = responseBody.includes('Could not find database')
      || responseBody.includes('shared with your integration')
      || responseBody.includes('object_not_found');

    if (isNotionAccessError) {
      return res.status(502).json({
        success: false,
        error: 'A integração do Notion usada pelo backend não tem acesso à tabela Ferramentas Clínicas.',
        details: responseBody.slice(0, 1000),
      });
    }

    if (responseBody.includes('duplicate_slug_in_notion_batch')) {
      let duplicateDetails = responseBody;
      try {
        duplicateDetails = JSON.parse(responseBody);
      } catch (_parseError) {
        // Mantém texto bruto se a resposta não estiver em JSON.
      }

      return res.status(409).json({
        success: false,
        error: 'Existem ferramentas duplicadas no Notion. O sync foi interrompido antes de gravar no Supabase.',
        details: duplicateDetails,
      });
    }

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: 'Falha ao sincronizar Ferramentas Clínicas.',
      details: responseBody.slice(0, 1000) || error?.message || 'Erro desconhecido',
    });
  }

  return res.status(200).json({
    success: true,
    data: result,
  });
};
