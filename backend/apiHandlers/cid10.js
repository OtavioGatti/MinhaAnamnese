const { ensureUserProfile } = require('../services/profiles');
const { searchCid10Codes } = require('../services/cid10');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');

// Busca por digitacao: o limite e alto porque cada tecla pode gerar uma
// consulta (o frontend faz debounce), mas ainda barra automacao abusiva.
const CID10_RATE_LIMIT = {
  limit: 120,
  windowMs: 10 * 60 * 1000,
};

// A expansao por IA e o unico trecho pago da busca, e so dispara quando nada
// mais achou. Limite proprio e bem menor: estourar aqui nao e erro, so desliga
// a ultima camada e a busca responde com o que as outras acharam.
const CID10_AI_EXPANSION_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

function getQueryParam(req, name) {
  if (typeof req.query?.[name] === 'string') {
    return req.query[name];
  }

  const url = new URL(req.url || '/api/cid10', 'http://localhost');
  return url.searchParams.get(name) || '';
}

function buildPaywallResponse(profile) {
  const accessState = profile?.access_state || null;

  return {
    success: false,
    error: 'A busca de CID-10 está disponível no plano profissional.',
    code: 'CID10_PRO_REQUIRED',
    data: {
      paywall: true,
      reason: accessState?.billingStatus === 'expired' ? 'expired' : 'pro_required',
      profile,
      accessState,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }

    const rateLimit = await consumeRateLimit({
      req,
      scope: 'cid10',
      userId: auth.user.id,
      ...CID10_RATE_LIMIT,
    });

    if (!rateLimit.allowed) {
      return sendRateLimitResponse(res, rateLimit);
    }

    const profile = await ensureUserProfile(auth.user);

    if (!profile?.access_state?.hasActiveProAccess) {
      return res.status(402).json(buildPaywallResponse(profile));
    }

    const results = await searchCid10Codes({
      query: getQueryParam(req, 'q'),
      limit: getQueryParam(req, 'limit'),
      // Cobrado sob demanda: a busca so chama isto quando esgotou as camadas
      // gratuitas. Consumir por requisicao gastaria a cota inteira digitando.
      allowAiExpansion: async () => {
        const aiLimit = await consumeRateLimit({
          req,
          scope: 'cid10_ai_expansion',
          userId: auth.user.id,
          ...CID10_AI_EXPANSION_RATE_LIMIT,
        });

        return aiLimit.allowed;
      },
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('cid10: failed to search codes', {
      statusCode: error?.statusCode || 500,
      message: error?.message || 'unknown_error',
    });

    return res.status(error.statusCode || 503).json({
      success: false,
      error: 'Não foi possível consultar a tabela CID-10 agora.',
    });
  }
};
