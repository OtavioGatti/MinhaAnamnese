// Molde visual compartilhado dos e-mails transacionais do produto — mesmo
// estilo usado no e-mail de confirmação de cadastro (Supabase Auth), pra
// manter identidade visual consistente em todo e-mail que o backend manda.

const CURRENT_YEAR = new Date().getFullYear();

function buildParagraph(text) {
  return `<p style="color:#374151; font-size:16px; line-height:1.7;">${text}</p>`;
}

function buildButton({ label, url }) {
  if (!label || !url) {
    return '';
  }

  return `<div style="text-align:center; margin:40px 0;">
      <a
        href="${url}"
        style="
          background:#2563eb;
          color:white;
          text-decoration:none;
          padding:16px 28px;
          border-radius:12px;
          font-weight:600;
          display:inline-block;
          font-size:16px;
        "
      >
        ${label}
      </a>
    </div>`;
}

/**
 * Monta o HTML completo de um e-mail transacional no estilo padrão do produto.
 * `paragraphs`: array de strings (HTML simples, ex. com <strong>) — cada uma
 * vira um parágrafo do corpo. `button`: { label, url } opcional. `footerNote`:
 * linha pequena e cinza antes do rodapé (ex. "pode ignorar este e-mail").
 */
function buildEmailHtml({ heading, paragraphs = [], button, footerNote }) {
  const bodyHtml = paragraphs.map(buildParagraph).join('\n');
  const buttonHtml = buildButton(button || {});
  const footerNoteHtml = footerNote
    ? `<p style="color:#6b7280; font-size:14px; line-height:1.6;">${footerNote}</p>`
    : '';

  return `<div style="font-family: Arial, Helvetica, sans-serif; background:#f5f7fb; padding:40px 20px;">
  <div style="max-width:600px; margin:0 auto; background:white; border-radius:16px; padding:40px; border:1px solid #e5e7eb;">

    <div style="text-align:center; margin-bottom:32px;">
      <h1 style="margin:0; color:#111827; font-size:32px;">
        Minha Anamnese
      </h1>

      <p style="color:#6b7280; margin-top:8px; font-size:16px;">
        Workspace clínico inteligente
      </p>
    </div>

    <h2 style="color:#111827; font-size:24px; margin-bottom:16px;">
      ${heading}
    </h2>

    ${bodyHtml}

    ${buttonHtml}

    ${footerNoteHtml}

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:32px 0;" />

    <p style="color:#9ca3af; font-size:13px; text-align:center; line-height:1.6;">
      © ${CURRENT_YEAR} Minha Anamnese • Plataforma clínica para otimização de atendimentos.
    </p>

  </div>
</div>`;
}

module.exports = {
  buildEmailHtml,
};
