// Cancelamento self-service da assinatura. Dois caminhos:
//
//  1) Dentro do prazo de arrependimento (7 dias corridos desde a aprovação do
//     último pagamento — CDC art. 49): estorno integral na Mercado Pago,
//     cancelamento da recorrência, revogação imediata do acesso e cancelamento
//     da comissão do afiliado (via RPC que trata carência/clawback).
//
//  2) Fora do prazo: comportamento clássico — só impede a PRÓXIMA cobrança; o
//     acesso já pago continua até plan_expires_at (fim do ciclo corrente).
//
// O reembolso também dispara o webhook 'refunded' de forma assíncrona; as ações
// deste handler são idempotentes com o webhook (mesmo padrão do reconcile).

const {
  getActiveBillingSubscriptionByUserId,
  upsertBillingSubscription,
} = require('../services/billingSubscriptions');
const {
  cancelMercadoPagoPreapproval,
  getMercadoPagoAccessToken,
} = require('../services/mercadoPagoPreapprovals');
const {
  getMercadoPagoPayment,
  refundMercadoPagoPayment,
} = require('../services/mercadoPagoPayments');
const { cancelAffiliateCommissionForRefund } = require('../services/affiliates');
const { ensureUserProfile, upsertProfile } = require('../services/profiles');
const { resolveSupabaseUser } = require('../utils/supabaseAuth');
const { consumeRateLimit, sendRateLimitResponse } = require('../utils/rateLimit');

const CANCEL_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Só pagamentos aprovados e dentro dos 7 dias desde a aprovação são estornáveis.
function isWithinRefundWindow(payment) {
  if (!payment || String(payment.status || '').toLowerCase() !== 'approved') {
    return false;
  }

  const approvedAtMs = payment.date_approved ? new Date(payment.date_approved).getTime() : NaN;

  if (!Number.isFinite(approvedAtMs)) {
    return false;
  }

  return Date.now() <= approvedAtMs + REFUND_WINDOW_MS;
}

async function markSubscriptionCancelled(subscription) {
  if (!subscription?.preapproval_id) {
    return;
  }

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
}

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
    const profile = await ensureUserProfile(auth.user).catch(() => null);
    const subscription = await getActiveBillingSubscriptionByUserId(auth.user.id).catch(() => null);
    const lastPaymentId = profile?.last_payment_id || null;

    // Confere a janela de arrependimento contra o pagamento AO VIVO na Mercado
    // Pago (date_approved é a fonte da verdade, não o snapshot local).
    const livePayment = lastPaymentId
      ? await getMercadoPagoPayment(lastPaymentId).catch(() => null)
      : null;
    const refundEligible = isWithinRefundWindow(livePayment);

    // Caminho 1: reembolso dentro do prazo.
    if (refundEligible) {
      await refundMercadoPagoPayment(lastPaymentId);

      if (subscription?.preapproval_id) {
        await cancelMercadoPagoPreapproval(subscription.preapproval_id).catch(() => null);
        await markSubscriptionCancelled(subscription);
      }

      // Estorno encerra o acesso na hora (diferente do cancelamento comum).
      await upsertProfile({
        id: auth.user.id,
        billing_status: 'expired',
        plan_expires_at: new Date().toISOString(),
      }).catch(() => null);

      // Comissão do afiliado deixa de ser devida (RPC trata carência/clawback).
      await cancelAffiliateCommissionForRefund(lastPaymentId).catch(() => null);

      return res.status(200).json({
        success: true,
        data: {
          refunded: true,
          refundAmount: typeof livePayment?.transaction_amount === 'number'
            ? livePayment.transaction_amount
            : null,
          currencyId: livePayment?.currency_id || 'BRL',
          accessUntil: null,
        },
      });
    }

    // Caminho 2: fora do prazo — precisa de recorrência ativa para cancelar.
    if (!subscription?.preapproval_id) {
      return res.status(400).json({
        success: false,
        error: 'Você não tem uma assinatura recorrente ativa para cancelar.',
      });
    }

    await cancelMercadoPagoPreapproval(subscription.preapproval_id);
    await markSubscriptionCancelled(subscription);

    return res.status(200).json({
      success: true,
      data: {
        refunded: false,
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
