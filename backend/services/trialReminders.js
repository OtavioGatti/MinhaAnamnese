// Reengajamento de fim de trial: identifica perfis com teste profissional
// terminando em breve ou já terminado, e envia um e-mail (via
// services/emailNotifications.js) avisando o usuário — hoje esse aviso só
// aparecia dentro do app, então quem não voltasse a abrir nunca via nada.
//
// Consulta profiles.plan_expires_at diretamente (não billing_status='expired'):
// esse campo só é atualizado de forma preguiçosa no próximo login/fetch de
// perfil (expireProfileAccessIfNeeded em profiles.js), então nunca dispararia
// para quem simplesmente não volta ao app.

const { sendEmail } = require('./emailNotifications');
const { buildEmailHtml } = require('./emailTemplates');

const DEFAULT_DAYS_BEFORE = 2;
const FIELD_ENDING_SOON = 'trial_reminder_2d_sent_at';
const FIELD_EXPIRED = 'trial_reminder_expired_sent_at';

function getProfilesAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isTrialReminderStorageAvailable() {
  const { url, serviceRoleKey } = getProfilesAdminConfig();
  return Boolean(url && serviceRoleKey);
}

function getTrialReminderDaysBefore() {
  const parsed = Number.parseInt(process.env.TRIAL_REMINDER_DAYS_BEFORE, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAYS_BEFORE;
}

function getAppUrl() {
  return process.env.PUBLIC_APP_URL || 'https://www.minhaanamnese.com.br';
}

function formatDateBR(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('pt-BR');
}

async function fetchProfiles(filterPairs) {
  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams();
  query.append('select', 'id,email,plan_expires_at');

  for (const [key, value] of filterPairs) {
    query.append(key, value);
  }

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`failed to query profiles for trial reminders (${response.status})`);
  }

  return response.json();
}

/**
 * Duas filas de perfis em trial que ainda não receberam o respectivo lembrete:
 * "terminando em breve" (dentro da janela de TRIAL_REMINDER_DAYS_BEFORE dias)
 * e "terminou" (plan_expires_at já passou).
 */
async function getDueTrialReminders() {
  if (!isTrialReminderStorageAvailable()) {
    return { endingSoon: [], expired: [] };
  }

  const nowIso = new Date().toISOString();
  const windowEndIso = new Date(Date.now() + getTrialReminderDaysBefore() * 86400000).toISOString();

  const [endingSoon, expired] = await Promise.all([
    fetchProfiles([
      ['access_source', 'eq.trial'],
      ['plan_expires_at', `gte.${nowIso}`],
      ['plan_expires_at', `lte.${windowEndIso}`],
      [FIELD_ENDING_SOON, 'is.null'],
    ]),
    fetchProfiles([
      ['access_source', 'eq.trial'],
      ['plan_expires_at', `lte.${nowIso}`],
      [FIELD_EXPIRED, 'is.null'],
    ]),
  ]);

  return { endingSoon, expired };
}

async function markReminderSent(profileId, field) {
  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams({ id: `eq.${profileId}` });

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ [field]: new Date().toISOString() }),
  });

  return response.ok;
}

// Tom direto, sem pressão — mesmo estilo do resto do produto (ver paywall/
// onboarding copy em frontend/src/App.jsx e WelcomeOnboardingModal.jsx),
// no mesmo molde visual do e-mail de confirmação de cadastro (emailTemplates.js).
function buildReminderEmail(kind, profile) {
  const appUrl = getAppUrl();

  if (kind === 'ending_soon') {
    return {
      subject: 'Seu teste profissional termina em breve',
      html: buildEmailHtml({
        heading: 'Seu teste está terminando ⏳',
        paragraphs: [
          `Seu teste profissional no <strong>Minha Anamnese</strong> termina em breve (${formatDateBR(profile.plan_expires_at)}).`,
          'Depois disso, sua conta volta ao plano básico e você perde acesso a avaliações completas, encaminhamentos com IA, guias de prescrição e bulário clínico.',
          'Para continuar sem interrupção, assine o Profissional — R$ 24,90/mês ou R$ 129,90 no semestral (~13% de desconto).',
        ],
        button: { label: 'Assinar o Profissional', url: appUrl },
        footerNote: 'Se você já assinou ou não deseja continuar, pode ignorar este e-mail com segurança.',
      }),
    };
  }

  return {
    subject: 'Seu teste no Minha Anamnese terminou',
    html: buildEmailHtml({
      heading: 'Seu teste terminou',
      paragraphs: [
        'Seu teste profissional de 7 dias no <strong>Minha Anamnese</strong> terminou.',
        'A organização básica de anamneses continua disponível gratuitamente — você não perdeu nada do que já criou.',
        'Se quiser continuar com avaliações completas, encaminhamentos com IA, guias de prescrição e bulário clínico, você pode assinar quando quiser.',
      ],
      button: { label: 'Assinar o Profissional', url: appUrl },
      footerNote: 'Sem pressa — pode assinar quando fizer sentido pra sua rotina.',
    }),
  };
}

async function processReminder(profile, kind, field) {
  const { subject, html } = buildReminderEmail(kind, profile);
  const result = await sendEmail({ to: profile.email, subject, html });

  if (result.ok) {
    await markReminderSent(profile.id, field).catch(() => null);
  }

  return {
    profileId: profile.id,
    email: profile.email,
    kind,
    ok: result.ok,
    error: result.error || null,
  };
}

/**
 * Processa as duas filas sequencialmente (evita rajada no provedor de e-mail
 * em lotes grandes). Retorna um resumo + os resultados individuais.
 */
async function runTrialReminders() {
  const { endingSoon, expired } = await getDueTrialReminders();
  const results = [];

  for (const profile of endingSoon) {
    results.push(await processReminder(profile, 'ending_soon', FIELD_ENDING_SOON));
  }

  for (const profile of expired) {
    results.push(await processReminder(profile, 'expired', FIELD_EXPIRED));
  }

  return {
    endingSoonFound: endingSoon.length,
    expiredFound: expired.length,
    endingSoonNotified: results.filter((r) => r.kind === 'ending_soon' && r.ok).length,
    expiredNotified: results.filter((r) => r.kind === 'expired' && r.ok).length,
    errors: results.filter((r) => !r.ok),
    results,
  };
}

module.exports = {
  FIELD_ENDING_SOON,
  FIELD_EXPIRED,
  isTrialReminderStorageAvailable,
  getTrialReminderDaysBefore,
  getDueTrialReminders,
  markReminderSent,
  buildReminderEmail,
  runTrialReminders,
};
