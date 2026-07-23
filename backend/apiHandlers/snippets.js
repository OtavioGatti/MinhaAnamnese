// Frases prontas: modelos de texto reutilizáveis (exame físico normal, conduta,
// orientação de alta...). Leitura liberada para todos (oficiais publicadas via
// CMS Notion + os modelos do próprio usuário quando logado). Criar modelo novo
// é recurso Pro; editar/apagar o que já é seu continua disponível para o dono
// (não fazemos o conteúdo do usuário de refém se o plano expirar).

const { listSyncedOfficialSnippets } = require('../services/officialSnippets');
const {
  createUserSnippet,
  deleteUserSnippet,
  listUserSnippets,
  updateUserSnippet,
} = require('../services/userSnippets');
const { ensureUserProfile } = require('../services/profiles');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const SNIPPETS_WRITE_RATE_LIMIT = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
};

function getSnippetIdFromRequest(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return String(req.body?.id || url.searchParams.get('id') || '').trim();
}

async function handleList(req, res) {
  const official = await listSyncedOfficialSnippets().catch(() => []);
  let mine = [];

  if (getAccessTokenFromRequest(req)) {
    const auth = await resolveSupabaseUser(req);

    if (auth.user?.id) {
      mine = await listUserSnippets(auth.user.id).catch(() => []);
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      official,
      mine,
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return handleList(req, res);
  }

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({
      success: false,
      error: auth.error,
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'snippets_write',
    userId: auth.user.id,
    ...SNIPPETS_WRITE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  try {
    if (req.method === 'POST') {
      const profile = await ensureUserProfile(auth.user).catch(() => null);

      if (!profile?.access_state?.hasActiveProAccess) {
        return res.status(403).json({
          success: false,
          error: 'Criar novos modelos é um recurso do plano profissional.',
        });
      }

      const snippet = await createUserSnippet(auth.user.id, {
        title: req.body?.title,
        body: req.body?.body,
        snippetType: req.body?.snippetType,
      });

      return res.status(200).json({ success: true, data: snippet });
    }

    if (req.method === 'PUT') {
      const snippetId = getSnippetIdFromRequest(req);

      if (!snippetId) {
        return res.status(400).json({ success: false, error: 'Modelo não informado.' });
      }

      const snippet = await updateUserSnippet(auth.user.id, snippetId, {
        title: req.body?.title,
        body: req.body?.body,
        snippetType: req.body?.snippetType,
      });

      return res.status(200).json({ success: true, data: snippet });
    }

    const snippetId = getSnippetIdFromRequest(req);

    if (!snippetId) {
      return res.status(400).json({ success: false, error: 'Modelo não informado.' });
    }

    await deleteUserSnippet(auth.user.id, snippetId);
    return res.status(200).json({ success: true, data: { deleted: true } });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    return res.status(isClientError ? statusCode : 503).json({
      success: false,
      error: isClientError ? error.message : 'Não foi possível salvar o modelo agora.',
    });
  }
};
