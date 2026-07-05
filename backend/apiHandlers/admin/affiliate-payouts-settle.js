const { settleAffiliatePayout } = require('../../services/affiliatePayouts');
const { hasAdminSecretConfigured, isAuthorizedAdminRequest } = require('../../utils/adminAuth');
const { isValidUserId } = require('../../utils/idValidation');
const { consumeRateLimit, sendRateLimitResponse } = require('../../utils/rateLimit');

const SETTLE_RATE_LIMIT = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

// Baixa administrativa de um saque após a transferência manual (PIX):
//   action 'paid'     -> saque pago; comissões viram 'paid' e o saldo zera.
//   action 'rejected' -> saque rejeitado; comissões voltam ao saldo disponível.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido.',
    });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'admin_affiliate_payouts_settle',
    ...SETTLE_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  if (!hasAdminSecretConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Administração de saques não configurada.',
    });
  }

  if (!isAuthorizedAdminRequest(req)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado.',
    });
  }

  const body = req.body || {};
  const payoutId = String(body.payoutId || '').trim();
  const action = String(body.action || '').trim().toLowerCase();
  const note = body.note !== undefined ? String(body.note || '').trim().slice(0, 280) || null : null;

  if (!isValidUserId(payoutId)) {
    return res.status(400).json({
      success: false,
      error: 'Informe um payoutId válido (uuid).',
    });
  }

  if (!['paid', 'rejected'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: "action deve ser 'paid' ou 'rejected'.",
    });
  }

  try {
    const payout = await settleAffiliatePayout({ payoutId, action, note });

    return res.status(200).json({
      success: true,
      data: {
        payout,
      },
    });
  } catch (error) {
    if (error?.code === 'payout_not_found') {
      return res.status(404).json({
        success: false,
        error: 'Saque não encontrado.',
      });
    }

    if (error?.code === 'payout_not_open') {
      return res.status(409).json({
        success: false,
        error: `Saque já finalizado (status: ${error?.details?.status || 'desconhecido'}).`,
      });
    }

    console.error('admin affiliate payout settle failed', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Administração de saques indisponível no momento.',
    });
  }
};
