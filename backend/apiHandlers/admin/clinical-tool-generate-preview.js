// Preview de geração de ferramenta clínica: gera e DEVOLVE o JSON com o
// resultado da validação, sem escrever no Notion. É o caminho recomendado antes
// de rodar a automação de verdade, porque mostra se a lógica gerada passaria no
// validador do catálogo.

const { generateClinicalTool } = require('../../services/generateClinicalTool');
const {
  isAuthorizedClinicalToolRequest,
  isClinicalToolSecretConfigured,
} = require('../../utils/clinicalToolAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 12, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'clinical_tool_generate_preview',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isClinicalToolSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de ferramentas não configurada.' });
  }

  if (!isAuthorizedClinicalToolRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { name, ferramenta } = req.body || {};
  const toolName = name || ferramenta;

  if (!toolName || typeof toolName !== 'string' || !toolName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Informe a ferramenta a ser gerada (ex.: "Escore de Centor").',
    });
  }

  try {
    const generated = await generateClinicalTool({ name: toolName });

    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        tool: generated.tool,
        validation: generated.validation,
        meta: generated.meta,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Não foi possível gerar a ferramenta agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
      details: String(error?.responseBody || '').slice(0, 500) || undefined,
    });
  }
};
