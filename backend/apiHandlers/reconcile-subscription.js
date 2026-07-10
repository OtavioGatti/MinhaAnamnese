const { reconcileSubscriptionByPreapprovalId } = require('./webhook/mercadopago');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const RECONCILE_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};
const PREAPPROVAL_ID_MAX_LENGTH = 64;

// Confirmação ativa da assinatura ao voltar do checkout de sucesso, sem
// depender do webhook do Mercado Pago chegar (assinaturas às vezes exigem
// Webhooks configurados a nível de Aplicação, não só o notification_url do
// checkout). Reaproveita a mesma lógica de negócio do webhook real.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
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
    scope: 'reconcile_subscription',
    userId: auth.user.id,
    ...RECONCILE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  const preapprovalId = String(req.body?.preapprovalId || '').trim().slice(0, PREAPPROVAL_ID_MAX_LENGTH);

  if (!preapprovalId) {
    return res.status(400).json({
      success: false,
      error: 'Informe o preapprovalId.',
    });
  }

  try {
    const result = await reconcileSubscriptionByPreapprovalId(preapprovalId, {
      expectedUserId: auth.user.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error?.code === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        error: 'Assinatura não pertence a este usuário.',
      });
    }

    if (error?.code === 'CONFIG_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        error: 'Confirmação indisponível no momento.',
      });
    }

    console.error('reconcile-subscription: failed', {
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Não foi possível confirmar a assinatura agora. Tente novamente em instantes.',
    });
  }
};
