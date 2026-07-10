// Cancelamento self-service da assinatura mensal recorrente. Só afeta a
// PRÓXIMA cobrança — o acesso Pro já pago continua até plan_expires_at (fim
// do ciclo corrente); a expiração normal (expireProfileAccessIfNeeded) cuida
// do resto depois. O semestral é cobrança única, não tem nada para cancelar
// aqui (não há assinatura recorrente 'authorized' para ele).

const {
  getActiveBillingSubscriptionByUserId,
  upsertBillingSubscription,
} = require('../services/billingSubscriptions');
const {
  cancelMercadoPagoPreapproval,
  getMercadoPagoAccessToken,
} = require('../services/mercadoPagoPreapprovals');
const { ensureUserProfile } = require('../services/profiles');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const CANCEL_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  if (!getMercadoPagoAccessToken()) {
    return res.status(503).json({
      success: false,
      error: 'Cancelamento indisponível: configure MERCADO_PAGO_ACCESS_TOKEN no servidor.',
    });
  }

  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({ success: false, error: auth.error });
  }

  const rateLimit = await consumeRateLimit({
    req,
    scope: 'cancel_subscription',
    userId: auth.user.id,
    ...CANCEL_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return sendRateLimitResponse(res, rateLimit);
  }

  try {
    const subscription = await getActiveBillingSubscriptionByUserId(auth.user.id);

    if (!subscription?.preapproval_id) {
      return res.status(400).json({
        success: false,
        error: 'Você não tem uma assinatura recorrente ativa para cancelar.',
      });
    }

    await cancelMercadoPagoPreapproval(subscription.preapproval_id);

    // Best-effort: reflete o cancelamento localmente na hora; o webhook do
    // Mercado Pago também confirma isso de forma assíncrona (fonte dupla,
    // mesmo padrão já usado no projeto para pagamentos).
    await upsertBillingSubscription({
      preapprovalId: subscription.preapproval_id,
      userId: subscription.user_id,
      status: 'cancelled',
      planKey: subscription.plan_key,
      amount: subscription.amount,
      currencyId: subscription.currency_id,
      payerEmail: subscription.payer_email,
      externalReference: subscription.external_reference,
      nextPaymentDate: subscription.next_payment_date,
      affiliateId: subscription.affiliate_id,
      affiliateCode: subscription.affiliate_code,
      providerCreatedAt: subscription.provider_created_at,
    }).catch(() => null);

    // Cancelar NÃO revoga o acesso já pago — só impede a próxima cobrança.
    const profile = await ensureUserProfile(auth.user).catch(() => null);

    return res.status(200).json({
      success: true,
      data: {
        accessUntil: profile?.plan_expires_at || profile?.access_state?.planExpiresAt || null,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const safeMessage = statusCode < 500
      ? 'Não foi possível cancelar a assinatura no provedor de pagamento agora.'
      : 'Cancelamento indisponível no momento.';

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: safeMessage,
    });
  }
};
