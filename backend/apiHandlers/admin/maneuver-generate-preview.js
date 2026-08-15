// Preview de geração de manobra: gera e DEVOLVE o JSON, sem escrever no Notion.
// Serve para conferir o conteúdo antes de rodar a automação de verdade.

const { generateManeuver } = require('../../services/generateManeuver');
const {
  isAuthorizedManeuverRequest,
  isManeuverSecretConfigured,
} = require('../../utils/maneuverAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 12, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'maneuver_generate_preview',
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

  const { name, manobra } = req.body || {};
  const maneuverName = name || manobra;

  if (!maneuverName || typeof maneuverName !== 'string' || !maneuverName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Informe a manobra a ser gerada (ex.: "Sinal de Giordano").',
    });
  }

  try {
    const generated = await generateManeuver({ name: maneuverName });

    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        maneuver: generated.maneuver,
        meta: generated.meta,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Não foi possível gerar a manobra agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
      details: String(error?.responseBody || '').slice(0, 500) || undefined,
    });
  }
};
