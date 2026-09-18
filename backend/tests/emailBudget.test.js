const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.EMAIL_DAILY_BUDGET;

const {
  DEFAULT_BUDGET,
  countEmailsSentToday,
  getDailyEmailBudget,
  getRemainingDailyBudget,
  recebeuEmailHoje,
  startOfDayInTimeZone,
} = require('../services/emailBudget');

test('o orçamento padrão deixa folga para o cadastro no plano gratuito (100/dia)', () => {
  assert.equal(getDailyEmailBudget(), DEFAULT_BUDGET);
  assert.ok(DEFAULT_BUDGET < 100, 'precisa sobrar cota para confirmação de cadastro');
});

test('o orçamento pode ser ajustado por variável de ambiente', () => {
  process.env.EMAIL_DAILY_BUDGET = '25';
  assert.equal(getDailyEmailBudget(), 25);

  process.env.EMAIL_DAILY_BUDGET = 'nao-e-numero';
  assert.equal(getDailyEmailBudget(), DEFAULT_BUDGET, 'valor inválido volta ao padrão');

  delete process.env.EMAIL_DAILY_BUDGET;
});

// Sem banco não dá para contar; nesse caso as rotinas não podem sair mandando.
test('sem conseguir contar os envios, o restante é zero', async () => {
  assert.equal(await countEmailsSentToday(), null);

  const orcamento = await getRemainingDailyBudget();

  assert.equal(orcamento.enviados, null);
  assert.equal(orcamento.restante, 0, 'melhor adiar do que arriscar o cadastro de alguém');
});

test('o dia começa à meia-noite de Brasília, não à de UTC', () => {
  // 18/09 01:30 em UTC ainda é 17/09 22:30 em Brasília.
  const inicio = startOfDayInTimeZone(new Date('2026-09-18T01:30:00Z'));

  assert.equal(inicio.toISOString(), '2026-09-17T03:00:00.000Z');
});

// Caso real de 18/09/2026: 13 pessoas receberam a ação de retorno de manhã e o
// "seu teste terminou" à tarde.
test('quem já recebeu outro e-mail hoje fica para a próxima rodada', () => {
  const agora = new Date('2026-09-18T20:00:00Z');

  assert.equal(recebeuEmailHoje({ reengagement_sent_at: '2026-09-18T11:58:00Z' }, agora), true);
  assert.equal(recebeuEmailHoje({ trial_reminder_2d_sent_at: '2026-09-18T13:00:00Z' }, agora), true);
  assert.equal(recebeuEmailHoje({ reengagement_sent_at: '2026-09-17T11:58:00Z' }, agora), false, 'ontem não conta');
  assert.equal(recebeuEmailHoje({}, agora), false);
  assert.equal(recebeuEmailHoje(null, agora), false);
});
