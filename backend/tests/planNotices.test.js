const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  decidePlanNotice,
  hadRejectionSinceLastApproval,
  runPlanNotices,
} = require('../services/planNotices');

const AGORA = new Date('2026-09-13T12:00:00Z');
const dias = (n) => new Date(AGORA.getTime() + n * 86400000).toISOString();
const perfil = (extra = {}) => ({ id: 'u1', email: 'a@b.com', plan_expires_at: dias(5), ...extra });
const SEMESTRAL = { plan_key: 'semiannual' };
const MENSAL = { plan_key: 'monthly', preapproval_id: 'pre-1' };

// --- semestral: não renova sozinho ------------------------------------------------

test('semestral a 5 dias do vencimento recebe "vencendo"', () => {
  const decisao = decidePlanNotice({ profile: perfil(), lastPayment: SEMESTRAL, now: AGORA });

  assert.deepEqual(decisao, { kind: 'semestral_vencendo', field: 'plan_ending_notice_for' });
});

test('semestral a 20 dias ainda não recebe nada', () => {
  assert.equal(decidePlanNotice({ profile: perfil({ plan_expires_at: dias(20) }), lastPayment: SEMESTRAL, now: AGORA }), null);
});

test('aviso já enviado para este vencimento não repete', () => {
  const expira = dias(5);

  assert.equal(decidePlanNotice({
    profile: perfil({ plan_expires_at: expira, plan_ending_notice_for: expira }),
    lastPayment: SEMESTRAL,
    now: AGORA,
  }), null);
});

// Renovou antes: a data de vencimento mudou, e o ciclo novo tem aviso próprio.
test('aviso de um vencimento antigo não bloqueia o do ciclo novo', () => {
  const decisao = decidePlanNotice({
    profile: perfil({ plan_expires_at: dias(5), plan_ending_notice_for: dias(-175) }),
    lastPayment: SEMESTRAL,
    now: AGORA,
  });

  assert.equal(decisao.kind, 'semestral_vencendo');
});

test('semestral vencido há 1 dia recebe "terminou"; há 5 dias, não mais', () => {
  assert.equal(decidePlanNotice({ profile: perfil({ plan_expires_at: dias(-1) }), lastPayment: SEMESTRAL, now: AGORA }).kind, 'semestral_terminou');
  assert.equal(decidePlanNotice({ profile: perfil({ plan_expires_at: dias(-5) }), lastPayment: SEMESTRAL, now: AGORA }), null);
});

// --- mensal: acesso pausado ---------------------------------------------------------

test('mensal vencido com assinatura viva e recusa recebe "acesso pausado"', () => {
  const decisao = decidePlanNotice({
    profile: perfil({ plan_expires_at: dias(-1) }),
    lastPayment: MENSAL,
    subscription: { status: 'authorized' },
    rejectedSinceLastApproval: true,
    now: AGORA,
  });

  assert.deepEqual(decisao, { kind: 'acesso_pausado', field: 'payment_paused_notice_for' });
});

test('quem cancelou não recebe "acesso pausado": escolheu parar', () => {
  assert.equal(decidePlanNotice({
    profile: perfil({ plan_expires_at: dias(-1) }),
    lastPayment: MENSAL,
    subscription: { status: 'cancelled' },
    rejectedSinceLastApproval: true,
    now: AGORA,
  }), null);
});

test('mensal vencido sem nenhuma recusa não recebe "acesso pausado"', () => {
  assert.equal(decidePlanNotice({
    profile: perfil({ plan_expires_at: dias(-1) }),
    lastPayment: MENSAL,
    subscription: { status: 'authorized' },
    rejectedSinceLastApproval: false,
    now: AGORA,
  }), null);
});

test('mensal ainda vigente não recebe aviso nenhum', () => {
  assert.equal(decidePlanNotice({
    profile: perfil({ plan_expires_at: dias(3) }),
    lastPayment: MENSAL,
    subscription: { status: 'authorized' },
    rejectedSinceLastApproval: true,
    now: AGORA,
  }), null);
});

test('perfil sem e-mail não entra', () => {
  assert.equal(decidePlanNotice({ profile: perfil({ email: null }), lastPayment: SEMESTRAL, now: AGORA }), null);
});

// --- recusa depois do último aprovado ---------------------------------------------

test('só conta recusa da mesma assinatura depois do último pagamento aprovado', () => {
  const pagamentos = [
    { user_id: 'u1', status: 'approved', processed_at: dias(-30), preapproval_id: 'pre-1', created_at: dias(-30) },
    { user_id: 'u1', status: 'rejected', preapproval_id: 'pre-1', created_at: dias(-40) },
  ];

  assert.equal(hadRejectionSinceLastApproval(pagamentos, 'u1', 'pre-1'), false, 'recusa antes do aprovado');

  pagamentos.push({ user_id: 'u1', status: 'rejected', preapproval_id: 'pre-1', created_at: dias(-2) });
  assert.equal(hadRejectionSinceLastApproval(pagamentos, 'u1', 'pre-1'), true);
  assert.equal(hadRejectionSinceLastApproval(pagamentos, 'u1', 'pre-outra'), false);
});

test('sem banco configurado a rotina responde pendente, sem lançar', async () => {
  const resultado = await runPlanNotices(AGORA);

  assert.ok(resultado.pendente);
});
