// Varre o catálogo publicado por exames com campos vazios e as marca
// "a corrigir" no Notion. NÃO gera conteúdo — só enfileira para o runner.

const { queueIncompleteExams } = require('../../services/examQueue');
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
    scope: 'exam_queue_incomplete',
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

  const { limit, dryRun } = req.body || {};

  try {
    const result = await queueIncompleteExams({ limit, dryRun: dryRun === true });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500 ? error.message : 'Falha ao enfileirar exames incompletos.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};
