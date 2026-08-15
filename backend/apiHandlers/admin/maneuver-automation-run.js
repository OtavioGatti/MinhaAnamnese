// Rota de POLLING da automação de manobras, chamada pelo painel (ou por um
// agendador). Processa páginas com Status Automação em {a gerar, a corrigir}.
// Aceita GET e POST; suporta dryRun (não escreve) e limit.

const { runManeuverAutomation } = require('../../services/maneuverAutomationRunner');
const {
  isAuthorizedManeuverRequest,
  isManeuverSecretConfigured,
} = require('../../utils/maneuverAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 12, windowMs: 10 * 60 * 1000 };

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
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'maneuver_automation_run',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isManeuverSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de manobras não configurada.' });
  }

  if (!isAuthorizedManeuverRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { dryRun, limit } = readParams(req);

  try {
    const result = await runManeuverAutomation({ limit, dryRun });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Falha ao rodar a automação de manobras.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};
