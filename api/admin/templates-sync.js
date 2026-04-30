const {
  isNotionTemplateSyncConfigured,
  syncNotionTemplates,
} = require('../../backend/services/notionTemplateSync');
const {
  consumeRateLimit,
  sendRateLimitResponse,
} = require('../../backend/utils/rateLimit');

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
  return getHeaderValue(req, 'x-template-sync-secret').trim() || getBearerToken(req);
}

function getExpectedSyncSecret() {
  return process.env.TEMPLATE_SYNC_SECRET || process.env.ADMIN_SYNC_SECRET || '';
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

  const rateLimit = consumeRateLimit({
    req,
    scope: 'templates_sync',
    limit: SYNC_RATE_LIMIT.limit,
    windowMs: SYNC_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!getExpectedSyncSecret()) {
    return res.status(503).json({
      success: false,
      error: 'Sincronizacao de templates nao configurada.',
    });
  }

  if (!isAuthorizedSyncRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso nao autorizado.',
    });
  }

  if (!isNotionTemplateSyncConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Integracao com Notion nao configurada.',
    });
  }

  const result = await syncNotionTemplates();

  return res.status(200).json({
    success: true,
    data: result,
  });
};
