const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { SUPPORT_TOPICS, getSupportDeadline, getSupportTopic } = require('../config/supportTopics');
const {
  buildConfirmationEmail,
  buildOwnerEmail,
  getSupportInbox,
  validateSupportRequest,
} = require('../services/supportRequests');

const FRONT = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'supportTopics.js')).href;

test('assuntos e prazos do site acompanham os do servidor', async () => {
  const front = await import(FRONT);

  assert.deepEqual(front.SUPPORT_TOPICS, SUPPORT_TOPICS);
  SUPPORT_TOPICS.forEach((topic) => {
    assert.equal(front.getSupportDeadline(topic.id), getSupportDeadline(topic));
  });
});

// Combinado com o dono em 21/10/2026: dinheiro em 24 h, o resto em 2 dias.
test('pagamento e cancelamento respondem em 24 horas; o resto em 2 dias', () => {
  assert.equal(getSupportDeadline(getSupportTopic('pagamento')), 'em até 24 horas');
  assert.equal(getSupportDeadline(getSupportTopic('cancelamento')), 'em até 24 horas');
  assert.equal(getSupportDeadline(getSupportTopic('erro')), 'em até 2 dias');
});

test('mensagem válida passa; assunto, e-mail e texto curto são recusados com motivo', () => {
  const ok = validateSupportRequest({ topic: 'erro', email: ' A@B.com ', message: 'O organizar travou na hora de gerar.' });
  assert.equal(ok.request.email, 'a@b.com');
  assert.equal(ok.request.topic.id, 'erro');

  assert.match(validateSupportRequest({ topic: 'inventado', email: 'a@b.com', message: 'mensagem longa o bastante' }).error, /assunto/);
  assert.match(validateSupportRequest({ topic: 'erro', email: 'sem-arroba', message: 'mensagem longa o bastante' }).error, /e-mail/);
  assert.match(validateSupportRequest({ topic: 'erro', email: 'a@b.com', message: 'curta' }).error, /mais/);
  assert.match(validateSupportRequest({ topic: 'erro', email: 'a@b.com', message: 'x'.repeat(4001) }).error, /4000/);
});

test('campo invisível preenchido é robô: nada é enviado', () => {
  assert.equal(validateSupportRequest({ website: 'http://spam', topic: 'erro', email: 'a@b.com', message: 'mensagem longa o bastante' }).bot, true);
});

test('e-mail do dono escapa o HTML da mensagem, marca o urgente e traz a conta', () => {
  const { request } = validateSupportRequest({
    topic: 'pagamento', email: 'a@b.com', name: 'Ana <b>', message: 'Cobrou duas vezes <script>alert(1)</script>\nsegunda linha',
  });
  const email = buildOwnerEmail(request, { userId: 'u1', email: 'a@b.com', plan: 'basic', billingStatus: 'expired', lastPayment: 'rejected (cc_rejected_high_risk)' });

  assert.match(email.subject, /^\[URGENTE\] Suporte: Pagamento/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /segunda linha/);
  assert.match(email.html, /cc_rejected_high_risk/);
  assert.match(email.html, /em até 24 horas/);
});

test('sem conta logada o e-mail do dono diz isso; a confirmação traz o prazo', () => {
  const { request } = validateSupportRequest({ topic: 'sugestao', email: 'a@b.com', message: 'Seria bom ter modo escuro.' });

  assert.match(buildOwnerEmail(request, null).html, /Sem conta logada/);
  assert.doesNotMatch(buildOwnerEmail(request, null).subject, /URGENTE/);
  assert.match(buildConfirmationEmail(request).html, /em até 2 dias/);
});

test('caixa do suporte padrão é a do produto; SUPPORT_EMAIL inválido não vale', () => {
  const anterior = process.env.SUPPORT_EMAIL;
  delete process.env.SUPPORT_EMAIL;
  assert.equal(getSupportInbox(), 'minhaanamnese@gmail.com');
  process.env.SUPPORT_EMAIL = 'nao-e-email';
  assert.equal(getSupportInbox(), 'minhaanamnese@gmail.com');
  process.env.SUPPORT_EMAIL = 'outro@exemplo.com';
  assert.equal(getSupportInbox(), 'outro@exemplo.com');
  if (anterior === undefined) delete process.env.SUPPORT_EMAIL; else process.env.SUPPORT_EMAIL = anterior;
});
