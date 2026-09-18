// Ação de retorno do teste. Protegida pelo ADMIN_SYNC_SECRET.
//
// Padrão é SIMULAÇÃO: sem `send: true` no corpo, devolve só a contagem por
// grupo, sem mandar nada. O envio real precisa ser pedido de propósito.

const { runReengagement } = require('../../services/reengagementEmails');
const { isEmailConfigured } = require('../../services/emailNotifications');
const { isAuthorizedAdminRequest, hasAdminSecretConfigured } = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };
// Teto por chamada: o Resend gratuito entrega 100 e-mails por dia, e os
// lembretes automáticos de fim de teste dividem essa cota.
const LIMITE_MAXIMO = 60;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'reengagement_run', ...RATE_LIMIT });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({ success: false, error: 'Rotas administrativas não configuradas.' });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
  }

  const body = req.body || {};
  const dryRun = body.send !== true;

  if (!dryRun && !isEmailConfigured()) {
    return res.status(503).json({ success: false, error: 'Envio não configurado: defina RESEND_API_KEY no servidor.' });
  }

  try {
    const data = await runReengagement({
      dryRun,
      expiresOn: typeof body.expiresOn === 'string' ? body.expiresOn : null,
      limit: Math.min(Number(body.limit) || LIMITE_MAXIMO, LIMITE_MAXIMO),
      excludeEmails: Array.isArray(body.excludeEmails) ? body.excludeEmails.slice(0, 50) : [],
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Não foi possível rodar a ação de retorno agora.',
      details: String(error?.message || '').slice(0, 300),
    });
  }
};
