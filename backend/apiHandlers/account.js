const { deleteUserAccount, exportUserData } = require('../services/accountManagement');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

const EXPORT_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};
const DELETE_RATE_LIMIT = {
  limit: 3,
  windowMs: 30 * 60 * 1000,
};

function getAction(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/export')) {
    return 'export';
  }

  if (pathname.endsWith('/delete')) {
    return 'delete';
  }

  return null;
}

async function handleExport(req, res, user) {
  const rateLimit = await consumeRateLimit({
    req,
    scope: 'account_export',
    userId: user.id,
    ...EXPORT_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  try {
    const data = await exportUserData(user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('account: export failed', { message: error?.message || 'unknown_error' });
    return res.status(503).json({
      success: false,
      error: 'Não foi possível exportar seus dados agora. Tente novamente em instantes.',
    });
  }
}

async function handleDelete(req, res, user) {
  const rateLimit = await consumeRateLimit({
    req,
    scope: 'account_delete',
    userId: user.id,
    ...DELETE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  // Confirmação explícita: o cliente precisa reenviar o próprio e-mail.
  const confirmationEmail = String(req.body?.confirmEmail || '').trim().toLowerCase();
  const accountEmail = String(user.email || '').trim().toLowerCase();

  if (!accountEmail || confirmationEmail !== accountEmail) {
    return res.status(400).json({
      success: false,
      error: 'Confirme digitando o e-mail exato da sua conta.',
    });
  }

  try {
    const result = await deleteUserAccount(user);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error?.code === 'CONFIG_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        error: 'Exclusão de conta indisponível no momento.',
      });
    }

    console.error('account: delete failed', { message: error?.message || 'unknown_error' });
    return res.status(503).json({
      success: false,
      error: 'Não foi possível excluir sua conta agora. Tente novamente em instantes.',
    });
  }
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  if (action === 'export' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  if (action === 'delete' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  if (!action) {
    return res.status(404).json({ success: false, error: 'Endpoint não encontrado.' });
  }

  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({ success: false, error: auth.error });
  }

  return action === 'export'
    ? handleExport(req, res, auth.user)
    : handleDelete(req, res, auth.user);
};
