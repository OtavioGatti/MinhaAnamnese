// Enfileira em lote bulas incompletas (campos vazios) marcando "a corrigir" no
// Notion, para o modo auto-completar do runner. Aceita dryRun (só lista) e limit.

const { queueIncompleteClinicalDrugs } = require('../../services/clinicalDrugQueue');
const {
  isClinicalDrugSecretConfigured,
  isAuthorizedClinicalDrugRequest,
} = require('../../utils/clinicalDrugAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 8, windowMs: 10 * 60 * 1000 };

function readParams(req) {
  const body = req.body || {};
  let query = {};

  try {
    query = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch (_error) {
    query = {};
  }

  const dryRun = body.dryRun === true || query.dryRun === 'true' || query.dryRun === '1';
  const limit = body.limit != null ? body.limit : query.limit;

  return { dryRun, limit };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'clinical_drug_queue_incomplete',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isClinicalDrugSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de bulário não configurada.' });
  }

  if (!isAuthorizedClinicalDrugRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { dryRun, limit } = readParams(req);

  try {
    const result = await queueIncompleteClinicalDrugs({ limit, dryRun });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Falha ao enfileirar bulas incompletas.';
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};
