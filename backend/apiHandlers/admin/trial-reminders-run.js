// Rota de polling do reengajamento de fim de trial, chamada por um agendador
// externo 1x/dia (ex.: n8n Schedule Trigger ou cron-job.org). Aceita GET e
// POST. Sem RESEND_API_KEY configurada, os envios falham best-effort (o
// perfil não é marcado como notificado, então tenta de novo na próxima vez).

const { runTrialReminders } = require('../../services/trialReminders');
const { isEmailConfigured } = require('../../services/emailNotifications');
const {
  isAuthorizedAdminRequest,
  hasAdminSecretConfigured,
} = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = {
  limit: 12,
  windowMs: 10 * 60 * 1000,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'trial_reminders_run',
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Rotas administrativas não configuradas.' });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Reengajamento de trial não configurado: defina RESEND_API_KEY no servidor.',
    });
  }

  try {
    const data = await runTrialReminders();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Não foi possível rodar o reengajamento de trial agora.',
      details: String(error?.message || '').slice(0, 300),
    });
  }
};
