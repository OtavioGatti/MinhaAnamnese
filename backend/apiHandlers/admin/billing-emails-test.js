// Envia os 9 e-mails de pagamento, com dados de exemplo, para o dono conferir
// no Gmail e no celular antes de valerem para clientes.
//
// Proteções, porque a rota dispara e-mail pelo domínio do produto:
// - só com o ADMIN_SYNC_SECRET;
// - só para o e-mail de uma conta JÁ CADASTRADA: se o segredo vazar, a rota
//   não vira disparador para qualquer endereço;
// - conteúdo fixo (nada vem do corpo além do destinatário) e assunto com
//   "[TESTE]", para ninguém confundir com cobrança real;
// - poucas chamadas por hora.

const { buildTestEmails } = require('../../services/billingEmails');
const { isEmailConfigured, sendEmail } = require('../../services/emailNotifications');
const { isAuthorizedAdminRequest, hasAdminSecretConfigured } = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
// O Resend aceita 2 envios por segundo no plano gratuito.
const INTERVALO_ENTRE_ENVIOS_MS = 650;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeTestRecipient(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_VALIDO.test(email) ? email : null;
}

async function isRegisteredAccountEmail(email) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return false;
  }

  const query = new URLSearchParams({ select: 'id', email: `eq.${email}`, limit: '1' });
  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!response.ok) {
    return false;
  }

  const json = await response.json().catch(() => []);
  return Array.isArray(json) && json.length > 0;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'billing_emails_test', ...RATE_LIMIT });

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
    return res.status(503).json({ success: false, error: 'Envio de e-mail não configurado: defina RESEND_API_KEY no servidor.' });
  }

  const to = normalizeTestRecipient(req.body?.to);

  if (!to) {
    return res.status(400).json({ success: false, error: 'Informe um e-mail válido em "to".' });
  }

  if (!(await isRegisteredAccountEmail(to).catch(() => false))) {
    return res.status(400).json({ success: false, error: 'Envie para o e-mail de uma conta cadastrada no Minha Anamnese.' });
  }

  const resultados = [];

  for (const [indice, email] of buildTestEmails().entries()) {
    if (indice > 0) {
      await pause(INTERVALO_ENTRE_ENVIOS_MS);
    }

    const envio = await sendEmail({ to, subject: `[TESTE] ${email.subject}`, html: email.html });
    resultados.push({ modelo: email.kind, ok: envio.ok, ...(envio.ok ? {} : { erro: envio.error }) });
  }

  return res.status(200).json({
    success: resultados.every((resultado) => resultado.ok),
    data: { enviados: resultados.filter((resultado) => resultado.ok).length, resultados },
  });
};

module.exports.normalizeTestRecipient = normalizeTestRecipient;
