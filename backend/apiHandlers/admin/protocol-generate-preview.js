// PREVIEW de geração de protocolo (dry-run). Gera o JSON via IA, aplica a
// trava de revisão humana e roda o cruzamento de medicamentos — e DEVOLVE tudo
// para revisão. NUNCA escreve no Notion. É a rota do critério de aceite nº 1.

const { generateProtocol } = require('../../services/generateProtocol');
const { buildAvailabilityReport } = require('../../services/medicationAvailability');
const {
  isProtocolSecretConfigured,
  isAuthorizedProtocolRequest,
} = require('../../utils/protocolAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'protocol_generate_preview',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isProtocolSecretConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Automação de protocolos não configurada.',
    });
  }

  if (!isAuthorizedProtocolRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { titulo, especialidade, contexto, subcondicao } = req.body || {};

  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Informe o título do protocolo a ser gerado (ex.: "Cefaleia tensional — Adulto").',
    });
  }

  try {
    const generated = await generateProtocol({ titulo, especialidade, contexto, subcondicao });
    const disponibilidade = buildAvailabilityReport(generated.protocol.texto_copiavel_prescricao);

    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        protocol: generated.protocol,
        disponibilidade,
        meta: generated.meta,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500
      ? error.message
      : 'Não foi possível gerar o protocolo agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
      details: String(error?.responseBody || '').slice(0, 500) || undefined,
    });
  }
};
