const { settleAffiliatePayout } = require('../services/affiliatePayouts');
const { getActionSecret, verifyPayoutActionToken } = require('../utils/payoutActionToken');
const { isValidUserId } = require('../utils/idValidation');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const ACTION_RATE_LIMIT = {
  limit: 60,
  windowMs: 10 * 60 * 1000,
};

const ACTION_LABELS = {
  paid: 'marcar como PAGO',
  rejected: 'REJEITAR',
};

function sendHtml(res, statusCode, title, bodyHtml) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 24px; }
  .card { max-width: 460px; margin: 32px auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 14px 30px rgba(15,23,42,0.08); }
  h1 { font-size: 1.25rem; margin: 0 0 12px; }
  p { line-height: 1.55; margin: 8px 0; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 0.85rem; word-break: break-all; }
  button { width: 100%; padding: 14px; border: 0; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 16px; }
  .paid { background: #16a34a; color: #fff; }
  .rejected { background: #dc2626; color: #fff; }
  .muted { color: #64748b; font-size: 0.85rem; }
  .ok { color: #166534; }
  .err { color: #991b1b; }
</style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;

  res.status(statusCode);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function getParams(req) {
  const query = req.query || {};
  return {
    payoutId: String(query.payout || '').trim(),
    action: String(query.action || '').trim().toLowerCase(),
    exp: String(query.exp || '').trim(),
    sig: String(query.sig || '').trim(),
  };
}

function isValidActionRequest({ payoutId, action, exp, sig }) {
  return (
    isValidUserId(payoutId) &&
    Object.prototype.hasOwnProperty.call(ACTION_LABELS, action) &&
    verifyPayoutActionToken({ payoutId, action, exp, sig })
  );
}

// Página de baixa de saque via link assinado (do WhatsApp).
//   GET  -> mostra confirmação (NÃO executa nada; seguro contra preview de link)
//   POST -> executa a baixa após o clique humano em "Confirmar"
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendHtml(res, 405, 'Método não permitido', '<h1>Método não permitido</h1>');
  }

  const rateLimit = await consumeRateLimit({ req, scope: 'payout_action', ...ACTION_RATE_LIMIT });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!getActionSecret()) {
    return sendHtml(res, 503, 'Indisponível', '<h1>Ação indisponível</h1><p class="muted">Configure PAYOUT_ACTION_SECRET ou ADMIN_SYNC_SECRET no servidor.</p>');
  }

  const params = getParams(req);

  if (!isValidActionRequest(params)) {
    return sendHtml(res, 401, 'Link inválido', '<h1 class="err">Link inválido ou expirado</h1><p class="muted">Solicite uma nova notificação de saque.</p>');
  }

  const { payoutId, action, exp, sig } = params;
  const actionQuery = new URLSearchParams({ payout: payoutId, action, exp, sig }).toString();

  if (req.method === 'GET') {
    return sendHtml(res, 200, 'Confirmar baixa', `
      <h1>Confirmar baixa de saque</h1>
      <p>Saque: <code>${payoutId}</code></p>
      <p>Ação: <strong>${action === 'paid' ? 'Marcar como PAGO' : 'Rejeitar'}</strong></p>
      <p class="muted">${action === 'paid'
        ? 'Confirme apenas após ter feito a transferência via PIX. Isso zera o saldo do afiliado.'
        : 'Rejeitar devolve o saldo ao afiliado.'}</p>
      <form method="POST" action="?${actionQuery}">
        <button type="submit" class="${action}">Confirmar (${ACTION_LABELS[action]})</button>
      </form>
    `);
  }

  try {
    await settleAffiliatePayout({ payoutId, action, note: 'Baixa via link do WhatsApp' });

    return sendHtml(res, 200, 'Saque baixado', `
      <h1 class="ok">${action === 'paid' ? '✅ Saque marcado como pago' : '✅ Saque rejeitado'}</h1>
      <p class="muted">Saque <code>${payoutId}</code> atualizado com sucesso.</p>
    `);
  } catch (error) {
    if (error?.code === 'payout_not_found') {
      return sendHtml(res, 404, 'Não encontrado', '<h1 class="err">Saque não encontrado</h1>');
    }

    if (error?.code === 'payout_not_open') {
      return sendHtml(res, 409, 'Já finalizado', `<h1 class="err">Saque já finalizado</h1><p class="muted">Status atual: ${error?.details?.status || 'desconhecido'}.</p>`);
    }

    console.error('affiliate-payout-action: settle failed', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown_error',
    });

    return sendHtml(res, 503, 'Erro', '<h1 class="err">Não foi possível processar agora</h1><p class="muted">Tente novamente em instantes.</p>');
  }
};
