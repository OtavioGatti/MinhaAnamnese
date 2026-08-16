// Preview de geração de exame: gera e DEVOLVE o JSON, sem escrever no Notion.
// Serve para conferir o conteúdo antes de rodar a automação de verdade.

const { generateExam } = require('../../services/generateExam');
const {
  isAuthorizedExamRequest,
  isExamSecretConfigured,
} = require('../../utils/examAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 12, windowMs: 10 * 60 * 1000 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'exam_generate_preview',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!isExamSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Automação de exames não configurada.' });
  }

  if (!isAuthorizedExamRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const { name, exame } = req.body || {};
  const examName = name || exame;

  if (!examName || typeof examName !== 'string' || !examName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Informe o exame a ser gerado (ex.: "Hemograma").',
    });
  }

  try {
    const generated = await generateExam({ name: examName });

    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        exam: generated.exam,
        meta: generated.meta,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Não foi possível gerar o exame agora.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
      details: String(error?.responseBody || '').slice(0, 500) || undefined,
    });
  }
};
