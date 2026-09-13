// Avisos de plano por e-mail, na rotina diária (a mesma chamada dos lembretes
// de fim de teste, em /api/admin/trial-reminders/run):
// - semestral vence em 7 dias, e semestral terminou: ele não renova sozinho;
// - acesso mensal pausado: venceu e a renovação não foi cobrada, mesmo depois
//   das novas tentativas do Mercado Pago.
//
// Cada aviso grava em profiles o plan_expires_at a que se refere. Quando o
// plano renova a data muda, e o aviso do ciclo novo volta a valer sem precisar
// limpar nada. Colunas criadas por supabase/profile_plan_notices.sql, aplicado
// à mão: até lá a rotina só responde que está pendente, sem afetar os
// lembretes de teste.

const { isEmailConfigured, sendEmail } = require('./emailNotifications');
const {
  buildAccessPausedEmail,
  buildPlanEndingSoonEmail,
  buildPlanExpiredEmail,
} = require('./billingEmails');

const DIA_MS = 24 * 60 * 60 * 1000;
const AVISO_ANTES_MS = 7 * DIA_MS;
// Uma rodada diária perdida não pode fazer o aviso sumir.
const AVISO_DEPOIS_MS = 3 * DIA_MS;
const INTERVALO_ENTRE_ENVIOS_MS = 650;
const PLANOS_CORTESIA = ['affiliate', 'afiliado'];

const CAMPO_SEMESTRAL_VENCENDO = 'plan_ending_notice_for';
const CAMPO_SEMESTRAL_TERMINOU = 'plan_expired_notice_for';
const CAMPO_ACESSO_PAUSADO = 'payment_paused_notice_for';

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function toTime(value) {
  const marca = new Date(value || '').getTime();
  return Number.isFinite(marca) ? marca : null;
}

/**
 * Qual aviso este perfil deve receber agora, se algum. Puro, para testar sem rede.
 *
 * `lastPayment` é o pagamento que deu o acesso atual (profiles.last_payment_id):
 * é ele que diz se o plano é mensal ou semestral.
 */
function decidePlanNotice({ profile, lastPayment = null, subscription = null, rejectedSinceLastApproval = false, now = new Date() }) {
  const expira = toTime(profile?.plan_expires_at);

  if (expira === null || !profile?.email) {
    return null;
  }

  const agora = now.getTime();
  const jaAvisado = (campo) => toTime(profile[campo]) === expira;
  const venceEmBreve = expira > agora && expira - agora <= AVISO_ANTES_MS;
  const venceuHaPouco = expira <= agora && agora - expira <= AVISO_DEPOIS_MS;

  if (lastPayment?.plan_key === 'semiannual') {
    if (venceEmBreve && !jaAvisado(CAMPO_SEMESTRAL_VENCENDO)) {
      return { kind: 'semestral_vencendo', field: CAMPO_SEMESTRAL_VENCENDO };
    }

    if (venceuHaPouco && !jaAvisado(CAMPO_SEMESTRAL_TERMINOU)) {
      return { kind: 'semestral_terminou', field: CAMPO_SEMESTRAL_TERMINOU };
    }

    return null;
  }

  // Mensal: só quem ainda tem a assinatura viva (não cancelou) e teve recusa
  // depois do último pagamento aprovado. Quem cancelou escolheu parar.
  if (lastPayment?.plan_key === 'monthly'
    && venceuHaPouco
    && subscription
    && subscription.status !== 'cancelled'
    && rejectedSinceLastApproval
    && !jaAvisado(CAMPO_ACESSO_PAUSADO)) {
    return { kind: 'acesso_pausado', field: CAMPO_ACESSO_PAUSADO };
  }

  return null;
}

function buildNoticeEmail(kind, profile) {
  if (kind === 'semestral_vencendo') {
    return buildPlanEndingSoonEmail({ expiresAt: profile.plan_expires_at });
  }

  if (kind === 'semestral_terminou') {
    return buildPlanExpiredEmail({ expiredAt: profile.plan_expires_at });
  }

  return buildAccessPausedEmail({ accessEndedAt: profile.plan_expires_at });
}

async function getRows(path) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!response.ok) {
    const erro = new Error(`consulta falhou (${response.status})`);
    erro.status = response.status;
    throw erro;
  }

  const json = await response.json();
  return Array.isArray(json) ? json : [];
}

async function markNoticeSent(profile, field) {
  const { url, serviceRoleKey } = getConfig();
  const query = new URLSearchParams({ id: `eq.${profile.id}` });
  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ [field]: profile.plan_expires_at }),
  });

  return response.ok;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Recusa da mesma assinatura depois do último pagamento aprovado da pessoa.
function hadRejectionSinceLastApproval(payments, userId, preapprovalId) {
  if (!preapprovalId) {
    return false;
  }

  const daPessoa = payments.filter((payment) => payment.user_id === userId);
  const ultimoAprovado = Math.max(
    0,
    ...daPessoa
      .filter((payment) => payment.status === 'approved' && payment.processed_at)
      .map((payment) => toTime(payment.created_at) || 0),
  );

  return daPessoa.some((payment) => (
    payment.status === 'rejected'
    && payment.preapproval_id === preapprovalId
    && (toTime(payment.created_at) || 0) > ultimoAprovado
  ));
}

async function runPlanNotices(now = new Date()) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return { pendente: 'banco_nao_configurado' };
  }

  if (!isEmailConfigured()) {
    return { pendente: 'email_nao_configurado' };
  }

  const perfisQuery = new URLSearchParams();
  perfisQuery.append('select', `id,email,plan_expires_at,last_payment_id,${CAMPO_SEMESTRAL_VENCENDO},${CAMPO_SEMESTRAL_TERMINOU},${CAMPO_ACESSO_PAUSADO}`);
  perfisQuery.append('access_source', 'eq.paid');
  perfisQuery.append('current_plan', `not.in.(${PLANOS_CORTESIA.join(',')})`);
  perfisQuery.append('plan_expires_at', `gte.${new Date(now.getTime() - AVISO_DEPOIS_MS).toISOString()}`);
  perfisQuery.append('plan_expires_at', `lte.${new Date(now.getTime() + AVISO_ANTES_MS).toISOString()}`);

  let perfis;

  try {
    perfis = await getRows(`profiles?${perfisQuery.toString()}`);
  } catch (error) {
    // 400 aqui é quase sempre a coluna nova ainda não criada.
    return error.status === 400
      ? { pendente: 'aplique supabase/profile_plan_notices.sql' }
      : { pendente: 'falha_ao_consultar_perfis' };
  }

  if (perfis.length === 0) {
    return { candidatos: 0, enviados: 0, falhas: 0, resultados: [] };
  }

  const ids = perfis.map((perfil) => perfil.id).join(',');
  const [pagamentos, assinaturas] = await Promise.all([
    getRows(`billing_payments?user_id=in.(${ids})&select=payment_id,user_id,status,plan_key,preapproval_id,processed_at,created_at&order=created_at.desc`),
    getRows(`billing_subscriptions?user_id=in.(${ids})&select=user_id,preapproval_id,status,created_at&order=created_at.desc`),
  ]);

  const resultados = [];

  for (const perfil of perfis) {
    const lastPayment = pagamentos.find((pagamento) => pagamento.payment_id === perfil.last_payment_id) || null;
    const subscription = lastPayment?.preapproval_id
      ? assinaturas.find((assinatura) => assinatura.preapproval_id === lastPayment.preapproval_id) || null
      : null;

    const decisao = decidePlanNotice({
      profile: perfil,
      lastPayment,
      subscription,
      rejectedSinceLastApproval: hadRejectionSinceLastApproval(pagamentos, perfil.id, lastPayment?.preapproval_id),
      now,
    });

    if (!decisao) {
      continue;
    }

    if (resultados.length > 0) {
      await pause(INTERVALO_ENTRE_ENVIOS_MS);
    }

    const email = buildNoticeEmail(decisao.kind, perfil);
    const envio = await sendEmail({ to: perfil.email, subject: email.subject, html: email.html });

    if (envio.ok) {
      await markNoticeSent(perfil, decisao.field).catch(() => null);
    }

    // Sem e-mail no resumo: a resposta da rotina pode parar em log de agendador.
    resultados.push({ profileId: perfil.id, modelo: decisao.kind, ok: envio.ok });
  }

  return {
    candidatos: perfis.length,
    enviados: resultados.filter((resultado) => resultado.ok).length,
    falhas: resultados.filter((resultado) => !resultado.ok).length,
    resultados,
  };
}

module.exports = {
  decidePlanNotice,
  hadRejectionSinceLastApproval,
  runPlanNotices,
};
