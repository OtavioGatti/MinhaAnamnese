// Modelos de carta/documento: formatos reutilizáveis por tipo (cabeçalho,
// assinatura, estrutura). Leitura liberada para todos (oficiais via CMS Notion +
// os modelos do próprio usuário quando logado). Criar modelo é recurso Pro;
// editar/apagar o que já é seu continua disponível para o dono.

const { listSyncedOfficialLetterModels } = require('../services/officialLetterModels');
const {
  createUserLetterModel,
  deleteUserLetterModel,
  listUserLetterModels,
  updateUserLetterModel,
} = require('../services/userLetterModels');
const { ensureUserProfile } = require('../services/profiles');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const LETTER_MODELS_WRITE_RATE_LIMIT = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
};

function getModelIdFromRequest(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return String(req.body?.id || url.searchParams.get('id') || '').trim();
}

function readModelPayload(req) {
  return {
    title: req.body?.title,
    letterType: req.body?.letterType,
    formatBody: req.body?.formatBody,
    isDefault: req.body?.isDefault === true,
  };
}

async function handleList(req, res) {
  const official = await listSyncedOfficialLetterModels().catch(() => []);
  let mine = [];

  if (getAccessTokenFromRequest(req)) {
    const auth = await resolveSupabaseUser(req);

    if (auth.user?.id) {
      mine = await listUserLetterModels(auth.user.id).catch(() => []);
    }
  }

  return res.status(200).json({
    success: true,
    data: { official, mine },
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return handleList(req, res);
  }

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({ success: false, error: auth.error });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'letter_models_write',
    userId: auth.user.id,
    ...LETTER_MODELS_WRITE_RATE_LIMIT,
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
          error: 'Criar novos modelos de carta é um recurso do plano profissional.',
        });
      }

      const model = await createUserLetterModel(auth.user.id, readModelPayload(req));
      return res.status(200).json({ success: true, data: model });
    }

    if (req.method === 'PUT') {
      const modelId = getModelIdFromRequest(req);

      if (!modelId) {
        return res.status(400).json({ success: false, error: 'Modelo não informado.' });
      }

      const model = await updateUserLetterModel(auth.user.id, modelId, readModelPayload(req));
      return res.status(200).json({ success: true, data: model });
    }

    const modelId = getModelIdFromRequest(req);

    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Modelo não informado.' });
    }

    await deleteUserLetterModel(auth.user.id, modelId);
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
