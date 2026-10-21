// "Fale com a gente" do rodapé. A mensagem vira e-mail para a caixa do suporte
// (SUPPORT_EMAIL) e não é guardada no banco.
//
// Proteções, porque a rota é pública e dispara e-mail pelo domínio do produto:
// - poucas mensagens por hora por IP;
// - campo invisível (`website`): robô que preenche recebe "ok" e nada sai;
// - a confirmação para a pessoa só vai para o e-mail da CONTA LOGADA, nunca
//   para o endereço digitado: senão a rota viraria disparador para qualquer
//   endereço. Sem conta, a confirmação fica só na tela.
const { sendEmail, isEmailConfigured } = require('../services/emailNotifications');
const {
  buildConfirmationEmail,
  buildOwnerEmail,
  getSupportInbox,
  validateSupportRequest,
} = require('../services/supportRequests');
const { getSupportDeadline } = require('../config/supportTopics');
const { getProfileByUserId } = require('../services/profiles');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

function hasBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return /^Bearer\s+\S+/i.test(String(header));
}

async function getLastPaymentSummary(userId) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  const query = new URLSearchParams({
    select: 'status,status_detail,amount,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/billing_payments?${query.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    return null;
  }

  const [payment] = await response.json().catch(() => []);

  if (!payment) {
    return null;
  }

  const quando = new Date(payment.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `${payment.status}${payment.status_detail ? ` (${payment.status_detail})` : ''}, R$ ${Number(payment.amount || 0).toFixed(2).replace('.', ',')}, ${quando}`;
}

// Contexto da conta para o dono não precisar procurar. Falha aqui não impede
// a mensagem de sair.
async function resolveAccountContext(req) {
  if (!hasBearerToken(req)) {
    return null;
  }

  const auth = await resolveSupabaseUser(req).catch(() => null);
  const user = auth?.user;

  if (!user?.id) {
    return null;
  }

  const [profile, lastPayment] = await Promise.all([
    getProfileByUserId(user.id).catch(() => null),
    getLastPaymentSummary(user.id).catch(() => null),
  ]);

  return {
    userId: user.id,
    email: user.email || profile?.email || '',
    plan: profile?.current_plan || null,
    billingStatus: profile?.billing_status || null,
    createdAt: profile?.created_at || user.created_at || null,
    lastPayment,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  const validation = validateSupportRequest(req.body || {});

  if (validation.error) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'support', ...RATE_LIMIT });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (validation.bot) {
    return res.status(200).json({ success: true, data: { prazo: getSupportDeadline(null) } });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Não foi possível enviar agora. Escreva para minhaanamnese@gmail.com.',
    });
  }

  const { request } = validation;
  const account = await resolveAccountContext(req).catch(() => null);
  const inbox = getSupportInbox();
  const ownerEmail = buildOwnerEmail(request, account);
  const sent = await sendEmail({ to: inbox, subject: ownerEmail.subject, html: ownerEmail.html, replyTo: request.email });

  if (!sent.ok) {
    console.warn('suporte: falha ao enviar para a caixa do suporte', sent.error);
    return res.status(502).json({
      success: false,
      error: `Não foi possível enviar agora. Tente de novo em instantes ou escreva para ${inbox}.`,
    });
  }

  if (account?.email) {
    const confirmation = buildConfirmationEmail(request);
    await sendEmail({ to: account.email, subject: confirmation.subject, html: confirmation.html, replyTo: inbox });
  }

  return res.status(200).json({
    success: true,
    data: {
      prazo: getSupportDeadline(request.topic),
      confirmacaoPorEmail: Boolean(account?.email),
    },
  });
};
