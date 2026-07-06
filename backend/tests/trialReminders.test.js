const assert = require('node:assert/strict');
const test = require('node:test');

// Sem SUPABASE_URL/SERVICE_ROLE_KEY, o serviço deve degradar graciosamente
// (sem tentar nenhuma chamada de rede) — não força credenciais reais aqui.
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RESEND_API_KEY;

const {
  isTrialReminderStorageAvailable,
  getTrialReminderDaysBefore,
  getDueTrialReminders,
  buildReminderEmail,
  runTrialReminders,
} = require('../services/trialReminders');

test('getTrialReminderDaysBefore usa o padrão de 2 dias e respeita override válido', () => {
  delete process.env.TRIAL_REMINDER_DAYS_BEFORE;
  assert.equal(getTrialReminderDaysBefore(), 2);

  process.env.TRIAL_REMINDER_DAYS_BEFORE = '5';
  assert.equal(getTrialReminderDaysBefore(), 5);

  process.env.TRIAL_REMINDER_DAYS_BEFORE = 'abc';
  assert.equal(getTrialReminderDaysBefore(), 2);

  delete process.env.TRIAL_REMINDER_DAYS_BEFORE;
});

test('isTrialReminderStorageAvailable é false sem credenciais do Supabase', () => {
  assert.equal(isTrialReminderStorageAvailable(), false);
});

test('getDueTrialReminders degrada para filas vazias sem Supabase configurado (sem tentar rede)', async () => {
  const result = await getDueTrialReminders();
  assert.deepEqual(result, { endingSoon: [], expired: [] });
});

test('buildReminderEmail "terminando em breve" inclui data, preços atuais e link', () => {
  const planExpiresAt = '2026-07-10T15:00:00.000Z';
  const { subject, html } = buildReminderEmail('ending_soon', { plan_expires_at: planExpiresAt });
  const expectedDate = new Date(planExpiresAt).toLocaleDateString('pt-BR');

  assert.equal(subject, 'Seu teste profissional termina em breve');
  assert.ok(html.includes(expectedDate), `esperava a data ${expectedDate} formatada no e-mail`);
  assert.match(html, /24,90/);
  assert.match(html, /129,90/);
});

test('buildReminderEmail "terminou" não pressiona e explica que o básico continua', () => {
  const { subject, html } = buildReminderEmail('expired', {});

  assert.equal(subject, 'Seu teste no Minha Anamnese terminou');
  assert.match(html, /organização básica.*continua disponível/i);
});

test('runTrialReminders com Supabase indisponível retorna resumo vazio e não lança', async () => {
  const summary = await runTrialReminders();

  assert.deepEqual(summary, {
    endingSoonFound: 0,
    expiredFound: 0,
    endingSoonNotified: 0,
    expiredNotified: 0,
    errors: [],
    results: [],
  });
});
