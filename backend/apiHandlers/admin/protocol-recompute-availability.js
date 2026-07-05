// Recalculo determinístico da disponibilidade de medicamentos em todos os
// protocolos (sem IA). Só relata — não reescreve texto clínico.

const { recomputeAvailability } = require('../../services/medicationAvailabilityRecompute');
const {
  isProtocolSecretConfigured,
  isAuthorizedProtocolRequest,
} = require('../../utils/protocolAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'protocol_recompute_availability',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isProtocolSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de protocolos não configurada.' });
  }

  if (!isAuthorizedProtocolRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const includeAll = (req.body && req.body.includeAll === true);

  try {
    const data = await recomputeAvailability({ onlyEmFalta: !includeAll });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Falha ao recalcular disponibilidade.';
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};
