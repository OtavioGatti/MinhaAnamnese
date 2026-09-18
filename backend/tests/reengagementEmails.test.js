const assert = require('node:assert/strict');
const test = require('node:test');

// Sem banco e sem Resend: prova que nada sai para a rede.
delete process.env.RESEND_API_KEY;
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  buildReengagementEmail,
  classifyReengagementGroup,
  describeUsage,
  runReengagement,
} = require('../services/reengagementEmails');

const texto = (email) => email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// --- grupos: as duas fontes, porque só os eventos subcontam quem recusa cookies

test('quem não tem sinal nenhum cai no grupo a', () => {
  assert.equal(classifyReengagementGroup({ organizou: false, acoes: [] }), 'a');
});

test('quem só aparece nos eventos (cookies aceitos) cai no b', () => {
  assert.equal(classifyReengagementGroup({ organizou: true, acoes: [] }), 'b');
});

test('quem usou recurso no servidor cai no b mesmo sem evento (recusou cookies)', () => {
  assert.equal(classifyReengagementGroup({ organizou: false, acoes: ['trial_clinical_drug'] }), 'b');
});

test('hipóteses ou prescrição levam direto ao grupo c', () => {
  assert.equal(classifyReengagementGroup({ organizou: false, acoes: ['trial_diagnostic_hypotheses'] }), 'c');
  assert.equal(classifyReengagementGroup({ organizou: true, acoes: ['trial_prescription_guide'] }), 'c');
});

// --- o que o grupo b lê sobre o próprio uso ------------------------------------

test('o e-mail do grupo b cita o que a pessoa já usou', () => {
  assert.match(describeUsage({ acoes: ['trial_clinical_drug'] }), /bulário clínico/);
  assert.match(describeUsage({ organizou: true, acoes: ['trial_clinical_drug', 'trial_insight'] }), /bulário clínico e a avaliação da anamnese/);
  assert.match(describeUsage({ organizou: true, acoes: [] }), /já organizou anamnese/);
});

// --- conteúdo dos três modelos --------------------------------------------------

test('grupo a: mostra o caminho até hipóteses e prescrição, com a data do teste', () => {
  const email = buildReengagementEmail('a', { expiresAt: '2026-09-18T21:00:00Z' });

  assert.match(texto(email), /termina em 18\/09\/2026/);
  assert.match(texto(email), /hipóteses diagnósticas/);
  assert.match(texto(email), /guia de prescrição/);
  assert.equal(/R\$/.test(email.html), false, 'não é hora de falar de preço');
});

test('grupo b: chama para as hipóteses, sem preço', () => {
  const email = buildReengagementEmail('b', { expiresAt: '2026-09-18T21:00:00Z', usage: { organizou: true, acoes: [] } });

  assert.match(texto(email), /já organizou anamnese/);
  assert.match(email.html, /Ver as hipóteses de um caso/);
  assert.equal(/R\$/.test(email.html), false);
});

test('grupo c: diz o que sai da conta e mostra o valor, com nota de desconto quando houver', () => {
  const comDesconto = buildReengagementEmail('c', { expiresAt: '2026-09-18T21:00:00Z', amount: 22.41 });
  const cheio = buildReengagementEmail('c', { expiresAt: '2026-09-18T21:00:00Z', amount: 24.9 });

  assert.match(texto(comDesconto), /R\$ 22,41 \(com o desconto de indicação/);
  assert.match(texto(cheio), /R\$ 24,90/);
  assert.equal(/desconto de indicação/.test(cheio.html), false);
  assert.match(email_link(comDesconto), /utm_campaign=retorno&utm_content=c/);
});

function email_link(email) {
  return (email.html.match(/href="([^"]+)"/) || [])[1] || '';
}

test('nenhum modelo menciona reembolso (decisão do dono: está nos termos)', () => {
  ['a', 'b', 'c'].forEach((grupo) => {
    const email = buildReengagementEmail(grupo, { expiresAt: '2026-09-18T21:00:00Z', amount: 22.41 });
    assert.equal(/reembols|estorn/i.test(email.html), false, `grupo ${grupo}`);
    assert.match(email.html, /Workspace clínico inteligente/, `grupo ${grupo} fora do molde`);
  });
});

// --- segurança do disparo --------------------------------------------------------

test('sem banco configurado a rotina não envia nada', async () => {
  const resultado = await runReengagement({ dryRun: false });

  assert.ok(resultado.pendente);
});
