const { getProfileByUserId } = require('./profiles');
const {
  getActiveBillingSubscriptionByUserId,
  upsertBillingSubscription,
} = require('./billingSubscriptions');
const { cancelMercadoPagoPreapproval, getMercadoPagoAccessToken } = require('./mercadoPagoPreapprovals');
const { isValidUserId } = require('../utils/idValidation');

function getSupabaseAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabaseSelect(path) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    throw new Error('account storage unavailable');
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`account storage request failed (${response.status})`);
  }

  return response.json();
}

// Portabilidade de dados (LGPD): reúne o que o produto guarda sobre o usuário.
async function exportUserData(user) {
  if (!isValidUserId(user?.id)) {
    throw new Error('valid user required');
  }

  const [profile, anamneses, payments] = await Promise.all([
    getProfileByUserId(user.id).catch(() => null),
    supabaseSelect(
      `anamneses?select=*&user_id=eq.${user.id}&order=created_at.desc`,
    ).catch(() => []),
    supabaseSelect(
      `billing_payments?select=payment_id,status,amount,currency_id,plan_key,billing_kind,processed_at,created_at&user_id=eq.${user.id}&order=created_at.desc`,
    ).catch(() => []),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email || profile?.email || null,
      created_at: user.created_at || null,
    },
    profile: profile
      ? {
          display_name: profile.display_name || null,
          current_plan: profile.current_plan,
          billing_status: profile.billing_status,
          access_source: profile.access_source,
          plan_expires_at: profile.plan_expires_at,
          default_contextual_tab: profile.default_contextual_tab,
          last_template_used: profile.last_template_used,
          created_at: profile.created_at,
        }
      : null,
    anamneses: Array.isArray(anamneses) ? anamneses : [],
    payments: Array.isArray(payments) ? payments : [],
  };
}

async function deleteSupabaseAuthUser(userId) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('account storage unavailable');
    error.code = 'CONFIG_UNAVAILABLE';
    throw error;
  }

  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`failed to delete auth user (${response.status})`);
  }
}

// Exclusão de conta (LGPD): cancela a assinatura recorrente (senão o Mercado
// Pago continua cobrando) e apaga o usuário. profiles/anamneses (PII) caem em
// cascata; billing/comissões viram SET NULL (auditoria financeira preservada e
// anonimizada).
async function deleteUserAccount(user) {
  if (!isValidUserId(user?.id)) {
    throw new Error('valid user required');
  }

  const subscription = await getActiveBillingSubscriptionByUserId(user.id).catch(() => null);

  if (subscription?.preapproval_id && getMercadoPagoAccessToken()) {
    await cancelMercadoPagoPreapproval(subscription.preapproval_id).catch(() => null);
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

  await deleteSupabaseAuthUser(user.id);

  return { deleted: true, cancelledSubscription: Boolean(subscription?.preapproval_id) };
}

module.exports = {
  deleteUserAccount,
  exportUserData,
};
