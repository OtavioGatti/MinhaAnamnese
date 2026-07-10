const crypto = require('crypto');
const {
  calculateCommissionAmount,
  getBillingPlan,
  getBillingPlanByAmount,
  getBillingPlanByProduct,
  isExpectedChargedAmount,
  normalizeDiscountRate,
  normalizePlanKey,
} = require('../../config/billingPlans');
const {
  cancelAffiliateCommissionsForPayment,
  createAffiliateCommission,
  getAffiliateByCode,
} = require('../../services/affiliates');
const { cancelMercadoPagoPreapproval } = require('../../services/mercadoPagoPreapprovals');
const {
  getBillingPaymentByPaymentId,
  upsertBillingPayment,
} = require('../../services/billingPayments');
const {
  getBillingSubscriptionByPreapprovalId,
  upsertBillingSubscription,
} = require('../../services/billingSubscriptions');
const { upsertProfile, getProfileByUserId: getStoredProfileByUserId } = require('../../services/profiles');
const { isValidUserId } = require('../../utils/idValidation');

const MERCADO_PAGO_PAYMENT_API = 'https://api.mercadopago.com/v1/payments';
const MERCADO_PAGO_PREAPPROVAL_API = 'https://api.mercadopago.com/preapproval';
const MERCADO_PAGO_AUTHORIZED_PAYMENT_API = 'https://api.mercadopago.com/authorized_payments';
const DEBUG_BILLING = process.env.DEBUG_BILLING === 'true';

function logBillingError(message, context = {}) {
  if (!DEBUG_BILLING) {
    return;
  }

  console.error('billing:', message, context);
}

function getMercadoPagoToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN
  );
}

function getMercadoPagoWebhookSecret() {
  return (
    process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
    process.env.MP_WEBHOOK_SECRET ||
    process.env.MERCADOPAGO_WEBHOOK_SECRET
  );
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function parseMercadoPagoSignature(signatureHeader) {
  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    return {
      ts: '',
      v1: '',
    };
  }

  return signatureHeader
    .split(',')
    .map((part) => part.trim())
    .reduce(
      (accumulator, part) => {
        const [key, value] = part.split('=');

        if (!key || !value) {
          return accumulator;
        }

        accumulator[key.trim()] = value.trim();
        return accumulator;
      },
      { ts: '', v1: '' },
    );
}

function getWebhookResourceId(req) {
  const body = req.body || {};
  const query = req.query || {};

  return (
    body?.data?.id ||
    body?.resource?.id ||
    body?.id ||
    query['data.id'] ||
    query.id ||
    null
  );
}

function getWebhookTopic(req) {
  const body = req.body || {};
  const query = req.query || {};

  return String(
    body.type ||
      body.topic ||
      body.action ||
      query.type ||
      query.topic ||
      '',
  ).toLowerCase();
}

function isAuthorizedPaymentWebhook(req) {
  // Pagamento gerado por uma assinatura (recorrência ou primeira cobrança).
  return getWebhookTopic(req).includes('authorized_payment');
}

// Status de pagamento em que o dinheiro voltou ao comprador: o acesso concedido
// por ele deixa de valer e a assinatura vinculada é cancelada automaticamente.
const REVOKED_PAYMENT_STATUSES = ['refunded', 'charged_back'];

function isRevokedPaymentStatus(status) {
  return REVOKED_PAYMENT_STATUSES.includes(String(status || '').toLowerCase());
}

function isSubscriptionWebhook(req) {
  const topic = getWebhookTopic(req);
  return topic.includes('preapproval') || topic.includes('subscription');
}

function isMercadoPagoWebhookSignatureValid(req, resourceId) {
  const secret = getMercadoPagoWebhookSecret();

  if (!secret) {
    return {
      valid: !isProductionEnvironment(),
      enforced: false,
      missingSecret: true,
    };
  }

  const signatureHeader =
    req.headers['x-signature'] ||
    req.headers['X-Signature'] ||
    '';
  const requestId =
    req.headers['x-request-id'] ||
    req.headers['X-Request-Id'] ||
    '';
  const { ts, v1 } = parseMercadoPagoSignature(signatureHeader);

  if (!resourceId || !requestId || !ts || !v1) {
    return {
      valid: false,
      enforced: true,
      missingSecret: false,
    };
  }

  const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const actual = String(v1).toLowerCase();
  const normalizedExpected = String(expected).toLowerCase();

  if (actual.length !== normalizedExpected.length) {
    return {
      valid: false,
      enforced: true,
      missingSecret: false,
    };
  }

  return {
    valid: crypto.timingSafeEqual(
      Buffer.from(actual),
      Buffer.from(normalizedExpected),
    ),
    enforced: true,
    missingSecret: false,
  };
}

async function getPaymentDetails(paymentId, accessToken) {
  const response = await fetch(`${MERCADO_PAGO_PAYMENT_API}/${paymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch payment');
  }

  return response.json();
}

async function getPreapprovalDetails(preapprovalId, accessToken) {
  const response = await fetch(`${MERCADO_PAGO_PREAPPROVAL_API}/${preapprovalId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch preapproval');
  }

  return response.json();
}

async function getAuthorizedPaymentDetails(authorizedPaymentId, accessToken) {
  const response = await fetch(`${MERCADO_PAGO_AUTHORIZED_PAYMENT_API}/${authorizedPaymentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch authorized payment');
  }

  return response.json();
}

async function getSupabaseUserById(userId, { url, serviceRoleKey }) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch user by id');
  }

  return response.json();
}

function normalizeBillingMetadata(currentMetadata, payment, plan, subscription = null, affiliateCode = null) {
  return {
    ...(currentMetadata || {}),
    last_payment_id: String(payment.id),
    last_payment_status: payment.status || null,
    last_approved_at: payment.date_approved || null,
    last_transaction_amount: Number(payment.transaction_amount) || null,
    last_currency_id: payment.currency_id || null,
    product: plan.product,
    plan_key: plan.key,
    billing_kind: plan.billingKind,
    plan_days: plan.days,
    preapproval_id: subscription?.preapproval_id || getPaymentPreapprovalId(payment) || null,
    affiliate_code: affiliateCode || null,
  };
}

function getNextPlanExpirationDate(currentPlanExpiresAt, planDays) {
  const days = Number(planDays) > 0 ? Number(planDays) : 30;
  const now = Date.now();
  const currentExpiry = currentPlanExpiresAt ? new Date(currentPlanExpiresAt).getTime() : 0;
  const baseTimestamp = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
  return new Date(baseTimestamp + (days * 24 * 60 * 60 * 1000)).toISOString();
}

async function updateSupabaseUserPlan(userId, currentMetadata, payment, plan, subscription, affiliateCode, { url, serviceRoleKey }) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      user_metadata: {
        ...(currentMetadata || {}),
        plan: 'pro',
        billing: normalizeBillingMetadata(currentMetadata?.billing, payment, plan, subscription, affiliateCode),
      },
    }),
  });

  if (!response.ok) {
    throw new Error('failed to update user plan');
  }
}

function hasExpectedCurrency(payment, plan) {
  return payment?.currency_id === plan.currencyId;
}

function getPaymentMetadata(payment) {
  return payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
}

function getPaymentPreapprovalId(payment) {
  const metadata = getPaymentMetadata(payment);
  return (
    payment?.preapproval_id ||
    metadata.preapproval_id ||
    metadata.preapprovalId ||
    null
  );
}

function getPaymentUserId(payment, subscription = null) {
  const metadata = getPaymentMetadata(payment);
  const candidate =
    metadata.userId ||
    metadata.user_id ||
    payment?.external_reference ||
    subscription?.user_id ||
    null;

  return isValidUserId(candidate) ? candidate : null;
}

function resolvePlanForPayment(payment, subscription = null) {
  const metadata = getPaymentMetadata(payment);
  const explicitPlanKey = metadata.plan_key || metadata.planKey || subscription?.plan_key || null;

  if (explicitPlanKey) {
    return getBillingPlan(normalizePlanKey(explicitPlanKey));
  }

  const productPlan = getBillingPlanByProduct(metadata.product || null);

  if (productPlan) {
    return productPlan;
  }

  return getBillingPlanByAmount(
    payment?.transaction_amount,
    subscription?.preapproval_id ? 'subscription' : null,
  );
}

function hasExpectedProduct(payment, plan, subscription = null) {
  if (subscription?.preapproval_id && plan.billingKind === 'subscription') {
    return true;
  }

  const metadata = getPaymentMetadata(payment);
  return metadata.product === plan.product;
}

function isApprovedPlanPayment(payment, plan, subscription = null, discountContext = {}) {
  return (
    payment?.status === 'approved' &&
    Boolean(payment?.date_approved) &&
    Boolean(plan) &&
    // Aceita preço cheio ou com desconto de afiliado. As taxas vêm de fontes
    // server-side (registro do afiliado, metadata criada pelo nosso checkout e
    // valor persistido da assinatura) — nunca do valor informado pelo cliente.
    isExpectedChargedAmount(plan, payment?.transaction_amount, {
      affiliateDiscountRate: discountContext.affiliateDiscountRate,
      metadataDiscountRate: discountContext.metadataDiscountRate,
      subscriptionAmount: subscription?.amount,
    }) &&
    hasExpectedCurrency(payment, plan) &&
    hasExpectedProduct(payment, plan, subscription)
  );
}

function getAffiliateCodeForPayment(payment, subscription = null) {
  const metadata = getPaymentMetadata(payment);
  return metadata.affiliate_code || metadata.affiliateCode || subscription?.affiliate_code || null;
}

async function persistPaymentSnapshot(payment, userId, plan = null, subscription = null, affiliate = null, processedAt = null) {
  const commissionAmount = affiliate
    ? calculateCommissionAmount(payment.transaction_amount, affiliate.commission_rate)
    : null;

  return upsertBillingPayment({
    paymentId: payment.id,
    userId,
    status: payment.status || 'unknown',
    amount: Number(payment.transaction_amount) || null,
    currencyId: payment.currency_id || null,
    product: getPaymentMetadata(payment).product || plan?.product || null,
    planKey: plan?.key || null,
    billingKind: plan?.billingKind || null,
    preapprovalId: subscription?.preapproval_id || getPaymentPreapprovalId(payment) || null,
    affiliateId: affiliate?.id || null,
    affiliateCode: affiliate?.code || getAffiliateCodeForPayment(payment, subscription) || null,
    commissionAmount,
    externalReference: payment.external_reference || null,
    payerEmail: getPaymentMetadata(payment).email || payment?.payer?.email || subscription?.payer_email || null,
    providerCreatedAt: payment.date_created || null,
    processedAt,
  });
}

async function persistPreapprovalSnapshot(preapproval, fallbackSubscription = null) {
  const userId = isValidUserId(preapproval?.external_reference)
    ? preapproval.external_reference
    : fallbackSubscription?.user_id || null;
  const plan = fallbackSubscription?.plan_key
    ? getBillingPlan(fallbackSubscription.plan_key)
    : getBillingPlanByAmount(preapproval?.auto_recurring?.transaction_amount, 'subscription') || getBillingPlan('monthly');

  return upsertBillingSubscription({
    preapprovalId: preapproval.id,
    userId,
    status: preapproval.status || fallbackSubscription?.status || 'pending',
    planKey: plan.key,
    amount: Number(preapproval?.auto_recurring?.transaction_amount) || fallbackSubscription?.amount || plan.price,
    currencyId: preapproval?.auto_recurring?.currency_id || fallbackSubscription?.currency_id || plan.currencyId,
    payerEmail: preapproval?.payer_email || fallbackSubscription?.payer_email || null,
    externalReference: preapproval?.external_reference || fallbackSubscription?.external_reference || null,
    nextPaymentDate: preapproval?.next_payment_date || fallbackSubscription?.next_payment_date || null,
    affiliateId: fallbackSubscription?.affiliate_id || null,
    affiliateCode: fallbackSubscription?.affiliate_code || null,
    providerCreatedAt: preapproval?.date_created || fallbackSubscription?.provider_created_at || null,
  });
}

async function handleSubscriptionWebhook(resourceId, accessToken) {
  const existingSubscription = await getBillingSubscriptionByPreapprovalId(resourceId).catch(() => null);
  const preapproval = await getPreapprovalDetails(resourceId, accessToken);

  await persistPreapprovalSnapshot(preapproval, existingSubscription).catch((error) => {
    logBillingError('failed to persist preapproval webhook snapshot', {
      preapprovalId: String(resourceId),
      message: error?.message || 'unknown_error',
    });
  });
}

async function handleAuthorizedPaymentWebhook(resourceId, accessToken, supabase) {
  const authorizedPayment = await getAuthorizedPaymentDetails(resourceId, accessToken);
  const paymentId = authorizedPayment?.payment?.id || authorizedPayment?.payment_id || null;
  const preapprovalId = authorizedPayment?.preapproval_id || null;

  if (!paymentId) {
    return { skipped: true };
  }

  // Reaproveita todo o fluxo de pagamento (validação, upgrade, comissão),
  // passando o preapproval como dica para resolver a assinatura/usuário.
  return handlePaymentWebhook(paymentId, accessToken, supabase, preapprovalId);
}

// Reembolso/chargeback: cancela a comissão do afiliado, cancela a assinatura
// vinculada no Mercado Pago e revoga o acesso concedido por ESTE pagamento
// (não mexe no acesso se ele veio de outro pagamento mais recente).
async function handleRevokedPayment({ payment, plan, subscription, userId, affiliate, accessToken }) {
  const paymentId = String(payment.id);

  await cancelAffiliateCommissionsForPayment(paymentId).catch((error) => {
    logBillingError('failed to cancel affiliate commissions after refund', {
      paymentId,
      message: error?.message || 'unknown_error',
    });
  });

  const preapprovalId = subscription?.preapproval_id || getPaymentPreapprovalId(payment);

  if (preapprovalId) {
    const cancelledPreapproval = await cancelMercadoPagoPreapproval(preapprovalId).catch((error) => {
      logBillingError('failed to cancel preapproval after refund', {
        paymentId,
        preapprovalId,
        message: error?.message || 'unknown_error',
      });
      return null;
    });

    const preapprovalSnapshot = cancelledPreapproval ||
      (await getPreapprovalDetails(preapprovalId, accessToken).catch(() => null)) ||
      { id: preapprovalId, status: 'cancelled' };

    await persistPreapprovalSnapshot(preapprovalSnapshot, subscription).catch(() => null);
  }

  if (userId) {
    const profile = await getStoredProfileByUserId(userId).catch(() => null);

    if (profile?.last_payment_id === paymentId) {
      await upsertProfile({
        id: userId,
        billing_status: 'expired',
        plan_expires_at: new Date().toISOString(),
      }).catch((error) => {
        logBillingError('failed to revoke access after refund', {
          paymentId,
          userId,
          message: error?.message || 'unknown_error',
        });
      });
    }
  }

  // Marca como processado com o status de estorno: notificações repetidas
  // caem no guard de idempotência.
  await persistPaymentSnapshot(payment, userId, plan, subscription, affiliate, new Date().toISOString());

  return { refunded: true };
}

async function handlePaymentWebhook(resourceId, accessToken, supabase, preapprovalIdHint = null) {
  const existingPayment = await getBillingPaymentByPaymentId(resourceId);

  // Estorno já tratado: nada a fazer.
  if (existingPayment?.processed_at && isRevokedPaymentStatus(existingPayment.status)) {
    return { alreadyProcessed: true };
  }

  const payment = await getPaymentDetails(resourceId, accessToken);

  // Pagamento processado e sem estorno novo: idempotência (sem re-persistir,
  // para não zerar processed_at nem reprocessar upgrade/comissão).
  if (existingPayment?.processed_at && !isRevokedPaymentStatus(payment?.status)) {
    return { alreadyProcessed: true };
  }

  const preapprovalId = getPaymentPreapprovalId(payment) || preapprovalIdHint;
  let subscription = preapprovalId
    ? await getBillingSubscriptionByPreapprovalId(preapprovalId).catch(() => null)
    : null;

  if (preapprovalId && !subscription) {
    const preapproval = await getPreapprovalDetails(preapprovalId, accessToken).catch(() => null);

    if (preapproval) {
      subscription = await persistPreapprovalSnapshot(preapproval, null).catch(() => null);
    }
  }

  const plan = resolvePlanForPayment(payment, subscription);
  const userId = getPaymentUserId(payment, subscription);
  const affiliateCode = getAffiliateCodeForPayment(payment, subscription);
  const affiliate = affiliateCode ? await getAffiliateByCode(affiliateCode).catch(() => null) : null;

  if (isRevokedPaymentStatus(payment?.status)) {
    return handleRevokedPayment({ payment, plan, subscription, userId, affiliate, accessToken });
  }

  await persistPaymentSnapshot(payment, userId, plan, subscription, affiliate, null);

  const discountContext = {
    affiliateDiscountRate: normalizeDiscountRate(affiliate?.discount_rate),
    metadataDiscountRate: normalizeDiscountRate(getPaymentMetadata(payment).discount_rate),
  };

  if (!plan || !isApprovedPlanPayment(payment, plan, subscription, discountContext)) {
    return { skipped: true };
  }

  if (!userId) {
    logBillingError('payment missing deterministic user link', {
      paymentId: String(payment.id),
    });

    return { skipped: true };
  }

  const targetUser = await getSupabaseUserById(userId, supabase);

  if (!targetUser?.id) {
    throw new Error('user not found');
  }

  const existingProfile = await getStoredProfileByUserId(targetUser.id).catch(() => null);
  const safeAffiliate = affiliate?.user_id === targetUser.id ? null : affiliate;

  await updateSupabaseUserPlan(targetUser.id, targetUser.user_metadata, payment, plan, subscription, safeAffiliate?.code || null, supabase);
  await upsertProfile({
    id: targetUser.id,
    email: targetUser.email || payment?.payer?.email || subscription?.payer_email || null,
    current_plan: 'pro',
    billing_status: 'active',
    access_source: 'paid',
    plan_expires_at: getNextPlanExpirationDate(existingProfile?.plan_expires_at, plan.days),
    last_payment_id: String(payment.id),
  });

  if (safeAffiliate) {
    await createAffiliateCommission({
      affiliate: safeAffiliate,
      buyerUserId: targetUser.id,
      paymentId: payment.id,
      planKey: plan.key,
      billingKind: plan.billingKind,
      grossAmount: Number(payment.transaction_amount) || null,
      currencyId: payment.currency_id || plan.currencyId,
    }).catch((error) => {
      logBillingError('failed to create affiliate commission', {
        paymentId: String(payment.id),
        affiliateCode: safeAffiliate.code,
        message: error?.message || 'unknown_error',
      });
    });
  }

  await persistPaymentSnapshot(payment, targetUser.id, plan, subscription, safeAffiliate, new Date().toISOString());

  return { processed: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  const accessToken = getMercadoPagoToken();
  const supabase = getSupabaseConfig();

  if (!accessToken || !supabase.url || !supabase.serviceRoleKey) {
    return res.status(200).json({ success: true, skipped: true });
  }

  const resourceId = getWebhookResourceId(req);

  if (!resourceId) {
    return res.status(200).json({ success: true });
  }

  const signatureCheck = isMercadoPagoWebhookSignatureValid(req, resourceId);

  if (signatureCheck.missingSecret && isProductionEnvironment()) {
    logBillingError('mercado pago webhook secret missing in production', {
      resourceId: String(resourceId),
    });

    return res.status(503).json({ success: false, error: 'webhook_config_unavailable' });
  }

  if (!signatureCheck.valid) {
    logBillingError('invalid mercado pago webhook signature', {
      resourceId: String(resourceId),
      enforced: signatureCheck.enforced,
    });

    return res.status(401).json({ success: false });
  }

  try {
    // Ordem importa: 'subscription_authorized_payment' contém 'subscription',
    // então o pagamento autorizado precisa ser checado antes da assinatura.
    if (isAuthorizedPaymentWebhook(req)) {
      const result = await handleAuthorizedPaymentWebhook(resourceId, accessToken, supabase);
      return res.status(200).json({ success: true, ...result });
    }

    if (isSubscriptionWebhook(req)) {
      await handleSubscriptionWebhook(resourceId, accessToken);
      return res.status(200).json({ success: true });
    }

    const result = await handlePaymentWebhook(resourceId, accessToken, supabase);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logBillingError('mercado pago webhook processing failed', {
      resourceId: String(resourceId),
      message: error?.message || 'unknown_error',
    });

    return res.status(500).json({ success: false });
  }
};

// Exportados para testes de regressão do roteamento (a ordem de classificação
// é o que faz a assinatura promover o usuário corretamente).
module.exports.getWebhookTopic = getWebhookTopic;
module.exports.isAuthorizedPaymentWebhook = isAuthorizedPaymentWebhook;
module.exports.isRevokedPaymentStatus = isRevokedPaymentStatus;
module.exports.isSubscriptionWebhook = isSubscriptionWebhook;
