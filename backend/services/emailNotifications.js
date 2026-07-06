// Envio de e-mail transacional via Resend, chamado direto por fetch (sem SDK,
// conforme convenção do projeto). Best-effort: nunca lança — quem chama decide
// o que fazer com uma falha de envio (ex.: não marcar o lembrete como enviado,
// para tentar de novo na próxima execução).

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Minha Anamnese <onboarding@resend.dev>';

function getResendConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
  };
}

function isEmailConfigured() {
  return Boolean(getResendConfig().apiKey);
}

/**
 * Envia um e-mail via Resend. Retorna { ok, id?, error? } — nunca lança.
 */
async function sendEmail({ to, subject, html }) {
  const { apiKey, from } = getResendConfig();

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY não configurada.' };
  }

  if (!to || !subject || !html) {
    return { ok: false, error: 'Parâmetros obrigatórios ausentes (to, subject, html).' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return { ok: false, error: `Resend respondeu ${response.status}: ${responseBody.slice(0, 300)}` };
    }

    const json = await response.json().catch(() => ({}));
    return { ok: true, id: json?.id || null };
  } catch (error) {
    return { ok: false, error: error?.message || 'Falha de conexão com o Resend.' };
  }
}

module.exports = {
  isEmailConfigured,
  sendEmail,
};
