const crypto = require('crypto');
const {
  getNotionTemplatesConfig,
  isNotionTemplateSyncConfigured,
  syncNotionTemplates,
} = require('../../../backend/services/notionTemplateSync');

const HANDLED_EVENT_TYPES = new Set([
  'page.created',
  'page.properties_updated',
  'page.content_updated',
  'page.deleted',
  'page.undeleted',
  'data_source.content_updated',
  'data_source.schema_updated',
]);

function getHeaderValue(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function normalizeNotionId(value) {
  return String(value || '').replace(/-/g, '').trim();
}

function getNotionWebhookVerificationToken() {
  return process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN || '';
}

function safeCompare(firstValue, secondValue) {
  const first = Buffer.from(String(firstValue || ''));
  const second = Buffer.from(String(secondValue || ''));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function getRequestBodyForSignature(req) {
  if (typeof req.rawBody === 'string' && req.rawBody) {
    return req.rawBody;
  }

  return JSON.stringify(req.body || {});
}

function isNotionWebhookSignatureValid(req) {
  const verificationToken = getNotionWebhookVerificationToken();
  const signatureHeader = getHeaderValue(req, 'x-notion-signature');

  if (!verificationToken || !signatureHeader) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', verificationToken)
    .update(getRequestBodyForSignature(req))
    .digest('hex')}`;

  return safeCompare(expectedSignature, signatureHeader);
}

function isRelevantTemplateEvent(body) {
  if (!HANDLED_EVENT_TYPES.has(body?.type)) {
    return false;
  }

  const configuredDataSourceId = normalizeNotionId(getNotionTemplatesConfig().dataSourceId);
  const entityId = normalizeNotionId(body?.entity?.id);
  const parentDataSourceId = normalizeNotionId(
    body?.data?.parent?.data_source_id ||
      body?.data?.data_source_id,
  );

  if (!configuredDataSourceId) {
    return false;
  }

  return (
    entityId === configuredDataSourceId ||
    parentDataSourceId === configuredDataSourceId ||
    (!parentDataSourceId && body?.entity?.type === 'page')
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

  if (req.body?.verification_token) {
    return res.status(200).json({
      success: true,
      data: {
        received: true,
      },
    });
  }

  if (!getNotionWebhookVerificationToken()) {
    return res.status(503).json({
      success: false,
      error: 'Webhook do Notion nao configurado.',
    });
  }

  if (!isNotionWebhookSignatureValid(req)) {
    return res.status(401).json({
      success: false,
      error: 'Assinatura invalida.',
    });
  }

  if (!isNotionTemplateSyncConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Integracao com Notion nao configurada.',
    });
  }

  if (!isRelevantTemplateEvent(req.body)) {
    return res.status(200).json({
      success: true,
      data: {
        ignored: true,
      },
    });
  }

  const result = await syncNotionTemplates();

  return res.status(200).json({
    success: true,
    data: result,
  });
};
