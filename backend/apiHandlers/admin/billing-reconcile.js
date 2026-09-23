const { reconcileOrderById, reprocessPaymentById } = require('../webhook/mercadopago');
const { hasAdminSecretConfigured, isAuthorizedAdminRequest } = require('../../utils/adminAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const RECONCILE_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

// Reprocessa um pagamento (ou pedido da Orders API) quando o aviso do Mercado
// Pago se perdeu ou foi ignorado. Mesma lógica do webhook, então é
// idempotente: pagamento já processado não é processado de novo; estorno novo
// cancela a comissão e revoga o acesso concedido por aquele pagamento.
//   { paymentId: "180542625422" }  ou  { orderId: "ORD01..." }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'admin_billing_reconcile',
    ...RECONCILE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Administração de pagamentos não configurada.',
    });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado.',
    });
  }

  const body = req.body || {};
  const paymentId = String(body.paymentId || '').trim();
  const orderId = String(body.orderId || '').trim();

  if (!/^\d{1,20}$/.test(paymentId) && !/^ORD[A-Z0-9]{8,60}$/.test(orderId)) {
    return res.status(400).json({
      success: false,
      error: 'Informe paymentId (número) ou orderId (ORD...).',
    });
  }

  try {
    const result = orderId
      ? await reconcileOrderById(orderId)
      : await reprocessPaymentById(paymentId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error?.code === 'CONFIG_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        error: 'Reprocessamento indisponível no momento.',
      });
    }

    if (error?.code === 'FORBIDDEN') {
      return res.status(404).json({
        success: false,
        error: 'Pedido não é da aplicação do semestral.',
      });
    }

    console.error('admin billing-reconcile: failed', {
      message: error?.message || 'unknown_error',
    });

    return res.status(502).json({
      success: false,
      error: 'Não foi possível reprocessar agora. Tente de novo em instantes.',
    });
  }
};
