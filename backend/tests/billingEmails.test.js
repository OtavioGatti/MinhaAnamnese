const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildPaymentRejectedEmail,
  buildTestEmails,
  buildWelcomeEmail,
  formatDate,
  formatMoney,
} = require('../services/billingEmails');
const { normalizeTestRecipient } = require('../apiHandlers/admin/billing-emails-test');

const texto = (email) => email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// --- regras que o dono decidiu ------------------------------------------------

test('os 9 modelos saem no molde oficial, com assunto', () => {
  const emails = buildTestEmails(new Date('2026-09-13T12:00:00Z'));

  assert.equal(emails.length, 9);
  assert.equal(new Set(emails.map((email) => email.kind)).size, 9, 'cada modelo é distinto');

  emails.forEach((email) => {
    assert.ok(email.subject, `${email.kind} sem assunto`);
    assert.match(email.html, /Workspace clínico inteligente/, `${email.kind} fora do molde`);
  });
});

test('nenhum e-mail menciona reembolso (decisão do dono: está nos termos)', () => {
  buildTestEmails().forEach((email) => {
    assert.equal(/reembols|estorn/i.test(email.html), false, `${email.kind} menciona reembolso`);
  });
});

test('boas-vindas do mensal: renovação automática, próxima cobrança e cancelamento', () => {
  const email = buildWelcomeEmail({ planKey: 'monthly', amount: 22.41, discounted: true, nextPaymentDate: '2026-10-13T15:00:00Z' });

  assert.match(texto(email), /Renovação: automática, todo mês/);
  assert.match(texto(email), /Próxima cobrança: 13\/10\/2026/);
  assert.match(texto(email), /R\$ 22,41 \(com desconto de indicação\)/);
  assert.match(texto(email), /Cancele quando quiser/);
});

test('boas-vindas do semestral: pagamento único e sem linha de cancelamento', () => {
  const email = buildWelcomeEmail({ planKey: 'semiannual', amount: 129.9, accessUntil: '2027-03-12T15:00:00Z' });

  assert.match(texto(email), /único, sem renovação automática/);
  assert.match(texto(email), /Acesso até: 12\/03\/2027/);
  assert.equal(/Cancelar assinatura/.test(email.html), false);
  assert.equal(/desconto de indicação/.test(email.html), false, 'sem desconto, sem nota');
});

test('linha sem dado some, em vez de sair vazia', () => {
  const email = buildWelcomeEmail({ planKey: 'monthly', amount: 24.9, nextPaymentDate: null });

  assert.equal(/Próxima cobrança/.test(email.html), false);
});

// --- pagamento não aprovado -------------------------------------------------

test('recusa na primeira tentativa: motivo, orientação, fim do teste e botão', () => {
  const email = buildPaymentRejectedEmail({
    amount: 22.41,
    statusDetail: 'cc_rejected_insufficient_amount',
    trialEndsAt: '2026-09-20T21:10:17Z',
  });

  assert.match(texto(email), /Motivo informado: Limite insuficiente/);
  assert.match(texto(email), /Tente outro cartão/);
  assert.match(texto(email), /continua ativo até 20\/09\/2026/);
  assert.match(email.html, /Tentar de novo/);
});

// Assinatura antiga segue ativa no Mercado Pago: um botão de pagar geraria
// cobrança dupla.
test('recusa na renovação não tem botão de pagar nem manda tentar de novo', () => {
  const email = buildPaymentRejectedEmail({ amount: 22.41, statusDetail: 'cc_rejected_call_for_authorize', renewal: true });

  assert.equal(/Tentar de novo|tente de novo/i.test(email.html), false);
  assert.equal(/<a\s/.test(email.html), false, 'sem link de ação');
  assert.match(texto(email), /tenta a cobrança de novo automaticamente/);
});

test('recusa sem motivo gravado não mostra o rótulo interno do painel', () => {
  const email = buildPaymentRejectedEmail({ amount: 22.41, statusDetail: null });

  assert.equal(/Motivo não registrado/.test(email.html), false);
});

test('recusa fora do teste oferece tentar com outro cartão', () => {
  const email = buildPaymentRejectedEmail({ amount: 24.9, statusDetail: 'cc_rejected_other_reason' });

  assert.match(texto(email), /tentar de novo com outro cartão/);
});

// --- formatação -------------------------------------------------------------

test('datas saem no dia de Brasília, não no de UTC', () => {
  // 14/09 01:30 em UTC ainda é 13/09 22:30 em Brasília.
  assert.equal(formatDate('2026-09-14T01:30:00Z'), '13/09/2026');
  assert.equal(formatDate(null), null);
  assert.equal(formatDate('data-invalida'), null);
});

test('valores em reais com vírgula; zero é zero', () => {
  assert.equal(formatMoney(22.41), 'R$ 22,41');
  assert.equal(formatMoney(129.9), 'R$ 129,90');
  assert.equal(formatMoney(0), 'R$ 0,00');
  assert.equal(formatMoney(null), null);
});

// --- rota de teste ------------------------------------------------------------

test('rota de teste só aceita um e-mail válido, normalizado', () => {
  assert.equal(normalizeTestRecipient('  Pessoa@Exemplo.com '), 'pessoa@exemplo.com');
  assert.equal(normalizeTestRecipient('sem-arroba'), null);
  assert.equal(normalizeTestRecipient(['a@b.com', 'c@d.com']), null, 'lista não vira vários destinatários');
  assert.equal(normalizeTestRecipient(undefined), null);
});
