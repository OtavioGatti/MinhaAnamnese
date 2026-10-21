// "Fale com a gente": a mensagem vira e-mail para o dono e não é guardada no
// banco (pode trazer dado de paciente, mesmo com o aviso no formulário).
const { buildEmailHtml } = require('./emailTemplates');
const { getSupportDeadline, getSupportTopic } = require('../config/supportTopics');

const SUPPORT_MESSAGE_MIN = 10;
const SUPPORT_MESSAGE_MAX = 4000;
const NAME_MAX = 120;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SUPPORT_EMAIL = 'minhaanamnese@gmail.com';

function getSupportInbox() {
  const email = String(process.env.SUPPORT_EMAIL || '').trim();
  return EMAIL_VALIDO.test(email) ? email : DEFAULT_SUPPORT_EMAIL;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * Valida o que veio do formulário. Retorna { request } ou { error }.
 * `website` é o campo invisível: gente não vê, robô preenche.
 */
function validateSupportRequest(body = {}) {
  if (cleanText(body.website, 200)) {
    return { bot: true };
  }

  const topic = getSupportTopic(String(body.topic || ''));

  if (!topic) {
    return { error: 'Escolha um assunto.' };
  }

  const email = cleanText(body.email, 254).toLowerCase();

  if (!EMAIL_VALIDO.test(email)) {
    return { error: 'Informe um e-mail válido para a gente responder.' };
  }

  const message = cleanText(body.message, SUPPORT_MESSAGE_MAX + 1);

  if (message.length < SUPPORT_MESSAGE_MIN) {
    return { error: 'Conte um pouco mais sobre o que aconteceu.' };
  }

  if (message.length > SUPPORT_MESSAGE_MAX) {
    return { error: `A mensagem pode ter até ${SUPPORT_MESSAGE_MAX} caracteres.` };
  }

  return {
    request: {
      topic,
      email,
      name: cleanText(body.name, NAME_MAX),
      message,
    },
  };
}

function formatAccount(account) {
  if (!account) {
    return 'Sem conta logada (mensagem enviada sem entrar no site).';
  }

  return [
    `<strong>Conta:</strong> ${escapeHtml(account.email || '')}`,
    `<strong>ID:</strong> ${escapeHtml(account.userId || '')}`,
    account.plan ? `<strong>Plano:</strong> ${escapeHtml(account.plan)}${account.billingStatus ? ` (${escapeHtml(account.billingStatus)})` : ''}` : '',
    account.createdAt ? `<strong>Conta criada em:</strong> ${escapeHtml(new Date(account.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}` : '',
    account.lastPayment ? `<strong>Último pagamento:</strong> ${escapeHtml(account.lastPayment)}` : '',
  ].filter(Boolean).join('<br>');
}

function buildOwnerEmail(request, account = null) {
  const prazo = getSupportDeadline(request.topic);
  const remetente = request.name ? `${escapeHtml(request.name)} &lt;${escapeHtml(request.email)}&gt;` : escapeHtml(request.email);
  const mensagem = escapeHtml(request.message).replace(/\n/g, '<br>');

  return {
    subject: `${request.topic.urgent ? '[URGENTE] ' : ''}Suporte: ${request.topic.label}`,
    html: buildEmailHtml({
      heading: request.topic.label,
      paragraphs: [
        `<strong>De:</strong> ${remetente}<br><strong>Responder ${prazo}.</strong>`,
        `<span style="display:block; background:#f3f4f6; border-radius:12px; padding:16px; color:#111827;">${mensagem}</span>`,
        formatAccount(account),
      ],
      footerNote: 'Responda este e-mail para falar direto com a pessoa.',
    }),
  };
}

function buildConfirmationEmail(request) {
  const prazo = getSupportDeadline(request.topic);
  const mensagem = escapeHtml(request.message).replace(/\n/g, '<br>');

  return {
    subject: 'Recebemos sua mensagem',
    html: buildEmailHtml({
      heading: 'Recebemos sua mensagem',
      paragraphs: [
        `Obrigado por falar com a gente. Sua mensagem sobre <strong>${escapeHtml(request.topic.label.toLowerCase())}</strong> chegou, e vamos responder neste e-mail <strong>${prazo}</strong>.`,
        `<strong>O que você escreveu:</strong><br><span style="color:#6b7280;">${mensagem}</span>`,
      ],
      footerNote: 'Se quiser acrescentar algo, é só responder este e-mail.',
    }),
  };
}

module.exports = {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  buildConfirmationEmail,
  buildOwnerEmail,
  escapeHtml,
  getSupportInbox,
  validateSupportRequest,
};
