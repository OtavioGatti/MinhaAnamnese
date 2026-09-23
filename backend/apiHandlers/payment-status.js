const { reconcileOrderById } = require('./webhook/mercadopago');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

// A tela do Pix pergunta a cada poucos segundos enquanto o QR Code vale.
const PAYMENT_STATUS_RATE_LIMIT = {
  limit: 120,
  windowMs: 10 * 60 * 1000,
};

// Situação do pedido criado na nossa página (semestral: Pix ou cartão em
// análise). Aprovado, libera o Pro com a mesma lógica do webhook,
// sem depender de o aviso do Mercado Pago chegar. Só responde sobre pagamento
// da própria conta.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const orderId = String(req.body?.orderId || '').trim();

  // Id de pedido da Orders API: ORD... (ORDTST... no sandbox).
  if (!/^ORD[A-Z0-9]{8,60}$/.test(orderId)) {
    return res.status(400).json({
      success: false,
      error: 'Informe o orderId.',
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
    scope: 'payment_status',
    userId: auth.user.id,
    ...PAYMENT_STATUS_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  try {
    const result = await reconcileOrderById(orderId, {
      expectedUserId: auth.user.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: result.status,
        reconciled: Boolean(result.reconciled),
      },
    });
  } catch (error) {
    if (error?.code === 'FORBIDDEN') {
      return res.status(403).json({
        success: false,
        error: 'Pedido não pertence a este usuário.',
      });
    }

    if (error?.code === 'CONFIG_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        error: 'Confirmação indisponível no momento.',
      });
    }

    console.error('payment-status: failed', {
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Não foi possível consultar o pagamento agora. Tente novamente em instantes.',
    });
  }
};
