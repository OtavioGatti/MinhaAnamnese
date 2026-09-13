// Quando mandar cada e-mail de pagamento, e para quem.
//
// Chamado pelo webhook do Mercado Pago e pelo cancelamento. Nunca lança e
// nunca vem antes do que importa: o e-mail sai DEPOIS de o pagamento estar
// processado, e qualquer falha vira log. Um erro aqui não pode chegar ao
// Mercado Pago, que reenviaria a notificação e reprocessaria o pagamento.
//
// Um e-mail por pagamento: a linha de billing_payments é reservada com
// notified_at antes do envio, então duas notificações simultâneas do mesmo
// pagamento não mandam dois e-mails.
//
// Destinatário é sempre o e-mail da CONTA, não o do pagador do cartão, que pode
// ser outra pessoa.

const {
  claimPaymentNotification,
  listPaymentsByUser,
  releasePaymentNotification,
} = require('./billingPayments');
const { isEmailConfigured, sendEmail } = require('./emailNotifications');
const {
  buildPaymentRejectedEmail,
  buildRenewalApprovedEmail,
  buildSubscriptionCancelledEmail,
  buildWelcomeEmail,
} = require('./billingEmails');

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
// Quem tenta de novo com outro cartão logo em seguida não recebe um e-mail por
// tentativa.
const INTERVALO_RECUSA_PRIMEIRA_MS = DIA_MS;
// Na renovação o Mercado Pago tenta até 4 vezes em 10 dias: um e-mail por
// mensalidade.
const INTERVALO_RECUSA_RENOVACAO_MS = 10 * DIA_MS;
// Notificação atrasada de uma recusa antiga não vira e-mail dias depois.
const RECUSA_VELHA_MS = 3 * DIA_MS;

// Renovação = já existe OUTRO pagamento aprovado e processado da MESMA
// assinatura. Assinatura nova, mesmo de quem já assinou antes, é boas-vindas.
function isRenewalOfSubscription({ paymentId, preapprovalId, history = [] }) {
  if (!preapprovalId) {
    return false;
  }

  return history.some((item) => (
    String(item.payment_id) !== String(paymentId)
    && item.preapproval_id === preapprovalId
    && item.status === 'approved'
    && Boolean(item.processed_at)
  ));
}

// Já saiu e-mail de recusa dentro do intervalo? Na primeira tentativa olha
// todas as recusas da pessoa, porque cada clique em assinar cria uma assinatura
// nova; na renovação, só as da mesma assinatura.
function wasRejectionRecentlyNotified({ paymentId, preapprovalId, renewal, history = [], now = new Date() }) {
  const intervalo = renewal ? INTERVALO_RECUSA_RENOVACAO_MS : INTERVALO_RECUSA_PRIMEIRA_MS;
  const limite = now.getTime() - intervalo;

  return history.some((item) => {
    if (String(item.payment_id) === String(paymentId) || item.status !== 'rejected' || !item.notified_at) {
      return false;
    }

    if (renewal && item.preapproval_id !== preapprovalId) {
      return false;
    }

    const marca = new Date(item.notified_at).getTime();
    return Number.isFinite(marca) && marca >= limite;
  });
}

function isStaleRejection(paymentCreatedAt, now = new Date()) {
  const marca = new Date(paymentCreatedAt || '').getTime();
  return Number.isFinite(marca) && now.getTime() - marca > RECUSA_VELHA_MS;
}

// Próxima cobrança só quando está no futuro: logo depois de cobrar, o Mercado
// Pago pode ainda devolver a data da cobrança que acabou de acontecer.
function pickNextPaymentDate(value, now = new Date()) {
  const marca = new Date(value || '').getTime();
  return Number.isFinite(marca) && marca > now.getTime() + HORA_MS
    ? new Date(marca).toISOString()
    : null;
}

function isDiscountedAmount(amount, plan) {
  const valor = Number(amount);
  const cheio = Number(plan?.price);
  return Number.isFinite(valor) && Number.isFinite(cheio) && valor > 0 && valor < cheio - 0.001;
}

function logFalha(motivo, contexto) {
  console.warn(`billing: ${motivo}`, JSON.stringify(contexto));
}

// Reserva, envia e, se o envio falhar, devolve a reserva: uma nova notificação
// do mesmo pagamento pode tentar outra vez.
async function sendReservedPaymentEmail({ paymentId, to, email }) {
  const reservado = await claimPaymentNotification(paymentId).catch(() => false);

  if (!reservado) {
    return { sent: false, reason: 'ja_notificado_ou_indisponivel' };
  }

  const envio = await sendEmail({ to, subject: email.subject, html: email.html });

  if (!envio.ok) {
    await releasePaymentNotification(paymentId).catch(() => null);
    logFalha('falha ao enviar e-mail de pagamento', {
      paymentId: String(paymentId),
      modelo: email.kind,
      erro: String(envio.error || '').slice(0, 200),
    });
    return { sent: false, reason: 'falha_envio' };
  }

  return { sent: true, kind: email.kind };
}

// Boas-vindas (primeira cobrança) ou renovação aprovada.
async function notifyApprovedPayment({
  paymentId,
  userId,
  to,
  plan,
  amount,
  preapprovalId = null,
  accessUntil = null,
  nextPaymentDate = null,
  now = new Date(),
}) {
  if (!to || !plan || !isEmailConfigured()) {
    return { sent: false, reason: 'sem_destinatario_plano_ou_email' };
  }

  // Sem histórico não dá para saber se é boas-vindas ou renovação: melhor não
  // mandar do que mandar o e-mail errado.
  const history = await listPaymentsByUser(userId).catch(() => null);

  if (!history) {
    return { sent: false, reason: 'historico_indisponivel' };
  }

  const renewal = plan.billingKind === 'subscription'
    && isRenewalOfSubscription({ paymentId, preapprovalId, history });
  const discounted = isDiscountedAmount(amount, plan);
  const proximaCobranca = pickNextPaymentDate(nextPaymentDate, now);

  const email = renewal
    ? buildRenewalApprovedEmail({ amount, discounted, accessUntil, nextPaymentDate: proximaCobranca })
    : buildWelcomeEmail({ planKey: plan.key, amount, discounted, nextPaymentDate: proximaCobranca, accessUntil });

  return sendReservedPaymentEmail({ paymentId, to, email });
}

// Pagamento não aprovado, com o motivo informado pelo Mercado Pago.
async function notifyRejectedPayment({
  paymentId,
  userId,
  to,
  amount,
  statusDetail = null,
  preapprovalId = null,
  trialEndsAt = null,
  paymentCreatedAt = null,
  now = new Date(),
}) {
  if (!to || !isEmailConfigured()) {
    return { sent: false, reason: 'sem_destinatario_ou_email' };
  }

  if (isStaleRejection(paymentCreatedAt, now)) {
    return { sent: false, reason: 'recusa_antiga' };
  }

  const history = await listPaymentsByUser(userId).catch(() => null);

  if (!history) {
    return { sent: false, reason: 'historico_indisponivel' };
  }

  const renewal = isRenewalOfSubscription({ paymentId, preapprovalId, history });

  if (wasRejectionRecentlyNotified({ paymentId, preapprovalId, renewal, history, now })) {
    return { sent: false, reason: 'recusa_ja_avisada' };
  }

  const email = buildPaymentRejectedEmail({
    amount,
    statusDetail,
    renewal,
    trialEndsAt: renewal ? null : trialEndsAt,
  });

  return sendReservedPaymentEmail({ paymentId, to, email });
}

// Confirmação do cancelamento comum. Quem cancela e não recebe nada tende a
// contestar a próxima cobrança no banco. Uma vez por ação: cancelar de novo
// falha antes ("sem assinatura ativa"), então não há o que reservar.
async function notifySubscriptionCancelled({ to, accessUntil = null }) {
  if (!to || !isEmailConfigured()) {
    return { sent: false, reason: 'sem_destinatario_ou_email' };
  }

  const email = buildSubscriptionCancelledEmail({ accessUntil });
  const envio = await sendEmail({ to, subject: email.subject, html: email.html });

  if (!envio.ok) {
    logFalha('falha ao enviar confirmação de cancelamento', { erro: String(envio.error || '').slice(0, 200) });
    return { sent: false, reason: 'falha_envio' };
  }

  return { sent: true, kind: email.kind };
}

module.exports = {
  INTERVALO_RECUSA_PRIMEIRA_MS,
  INTERVALO_RECUSA_RENOVACAO_MS,
  isDiscountedAmount,
  isRenewalOfSubscription,
  isStaleRejection,
  notifyApprovedPayment,
  notifyRejectedPayment,
  notifySubscriptionCancelled,
  pickNextPaymentDate,
  wasRejectionRecentlyNotified,
};
