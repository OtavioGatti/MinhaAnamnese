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
  buildReminderFilters,
  getDueTrialReminders,
  buildReminderEmail,
  runTrialReminders,
} = require('../services/trialReminders');

const FILTER_WINDOW = {
  nowIso: '2026-08-29T12:00:00.000Z',
  windowEndIso: '2026-08-31T12:00:00.000Z',
};

function findFilter(filters, key) {
  return filters.filter(([field]) => field === key).map(([, value]) => value);
}

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

// Regressão real: promover alguém a afiliado troca só o current_plan, deixando
// access_source='trial' e a data de expiração do cadastro. Sem excluir o plano,
// esses perfis ficavam presos na fila e recebiam "seu teste está acabando".
test('nenhuma das filas inclui planos de cortesia (afiliado)', () => {
  for (const stage of ['ending_soon', 'expired']) {
    const filters = buildReminderFilters(stage, FILTER_WINDOW);
    const planFilters = findFilter(filters, 'current_plan');

    assert.equal(planFilters.length, 1, `${stage}: esperava um filtro de current_plan`);
    assert.match(planFilters[0], /^not\.in\./, `${stage}: o filtro de plano precisa ser exclusão`);
    assert.match(planFilters[0], /affiliate/, `${stage}: precisa excluir "affiliate"`);
    assert.match(planFilters[0], /afiliado/, `${stage}: precisa excluir a grafia legada "afiliado"`);
  }
});

test('as filas continuam restritas a quem está de fato em trial', () => {
  for (const stage of ['ending_soon', 'expired']) {
    const filters = buildReminderFilters(stage, FILTER_WINDOW);
    assert.deepEqual(findFilter(filters, 'access_source'), ['eq.trial'], `${stage}: público errado`);
  }
});

test('cada fila filtra pelo próprio carimbo de envio e pela janela certa', () => {
  const endingSoon = buildReminderFilters('ending_soon', FILTER_WINDOW);
  assert.deepEqual(findFilter(endingSoon, 'trial_reminder_2d_sent_at'), ['is.null']);
  assert.deepEqual(findFilter(endingSoon, 'plan_expires_at'), [
    `gte.${FILTER_WINDOW.nowIso}`,
    `lte.${FILTER_WINDOW.windowEndIso}`,
  ]);

  const expired = buildReminderFilters('expired', FILTER_WINDOW);
  assert.deepEqual(findFilter(expired, 'trial_reminder_expired_sent_at'), ['is.null']);
  assert.deepEqual(findFilter(expired, 'plan_expires_at'), [`lte.${FILTER_WINDOW.nowIso}`]);
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
