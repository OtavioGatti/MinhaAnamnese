const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  buildWindows,
  countAffiliateVisits,
  countDistinctByWindow,
  summarizeActivation,
  summarizeAffiliates,
  summarizeEventUsage,
  summarizePayments,
  summarizeProfiles,
  summarizeRetention,
  summarizeReturn,
  summarizeStepReach,
} = require('../services/ownerMetrics');
const {
  createOwnerMetricsToken,
  verifyOwnerMetricsToken,
} = require('../utils/ownerMetricsToken');

const FUTURO = new Date(Date.now() + 86400000).toISOString();
const PASSADO = new Date(Date.now() - 86400000).toISOString();

test('summarizeProfiles separa Pro vigente, cortesia e expirado', () => {
  const resumo = summarizeProfiles([
    { current_plan: 'pro', billing_status: 'active', plan_expires_at: FUTURO, trial_started_at: PASSADO },
    { current_plan: 'pro', billing_status: 'active', plan_expires_at: PASSADO, trial_started_at: PASSADO },
    { current_plan: 'pro', billing_status: 'expired', plan_expires_at: FUTURO, trial_started_at: null },
    { current_plan: 'affiliate', billing_status: 'inactive', plan_expires_at: null, trial_started_at: null },
    { current_plan: 'basic', billing_status: 'inactive', plan_expires_at: null, trial_started_at: PASSADO },
  ]);

  assert.equal(resumo.total, 5);
  assert.equal(resumo.proVigente, 1, 'só o que tem data futura e billing ativo conta');
  assert.equal(resumo.afiliadoCortesia, 1);
  assert.equal(resumo.basico, 3, 'expirado por data e por billing caem em básico');
  assert.equal(resumo.comTrial, 3);
});

test('summarizeProfiles trata plano sem data de expiração como vigente', () => {
  const resumo = summarizeProfiles([
    { current_plan: 'pro', billing_status: 'active', plan_expires_at: null },
  ]);

  assert.equal(resumo.proVigente, 1);
});

test('summarizePayments soma só aprovados e separa estorno', () => {
  const resumo = summarizePayments([
    { status: 'approved', amount: 24.9, user_id: 'u1' },
    { status: 'approved', amount: 24.9, user_id: 'u1' },
    { status: 'approved', amount: 129.9, user_id: 'u2' },
    { status: 'refunded', amount: 24.9, user_id: 'u3' },
    { status: 'rejected', amount: 24.9, user_id: 'u4' },
  ]);

  assert.equal(resumo.aprovados, 3);
  assert.equal(resumo.receitaBruta, 179.7);
  assert.equal(resumo.receitaEstornada, 24.9);
  assert.equal(resumo.recusados, 1);
  assert.equal(resumo.compradoresUnicos, 2, 'mesmo usuário pagando 2x conta uma vez');
});

test('summarizeRetention conta dias distintos, não eventos', () => {
  const resumo = summarizeRetention([
    { user_id: 'u1', created_at: '2026-08-01T10:00:00Z' },
    { user_id: 'u1', created_at: '2026-08-01T18:00:00Z' },
    { user_id: 'u1', created_at: '2026-08-02T10:00:00Z' },
    { user_id: 'u2', created_at: '2026-08-01T10:00:00Z' },
    { user_id: null, created_at: '2026-08-01T10:00:00Z' },
  ]);

  assert.equal(resumo.usuariosComEvento, 2, 'evento anônimo não entra na retenção');
  assert.equal(resumo.umDiaSo, 1);
  assert.equal(resumo.doisATresDias, 1);
  assert.equal(resumo.mediaDiasAtivos, 1.5);
});

// Motivo de existir: o funil estrito exige a sequência exata, e na base real o
// CTA costuma vir ANTES do score — zerando as últimas etapas. O alcance ignora
// ordem e por isso não mente.
test('summarizeStepReach conta sessões por etapa mesmo fora de ordem', () => {
  const steps = ['anamnese_gerada', 'score_exibido', 'cta_avaliacao_click'];
  const resumo = summarizeStepReach([
    // sessão com o CTA antes do score: o funil estrito pararia aqui
    { session_id: 's1', event_name: 'anamnese_gerada' },
    { session_id: 's1', event_name: 'cta_avaliacao_click' },
    { session_id: 's1', event_name: 'score_exibido' },
    // sessão que só gerou anamnese
    { session_id: 's2', event_name: 'anamnese_gerada' },
    // evento fora do funil não cria etapa, mas a sessão conta no total
    { session_id: 's3', event_name: 'carta_gerada' },
  ], steps);

  assert.equal(resumo.totalSessoes, 3);
  assert.deepEqual(
    resumo.etapas.map((e) => [e.nome, e.sessoes]),
    [['anamnese_gerada', 2], ['score_exibido', 1], ['cta_avaliacao_click', 1]],
  );
  assert.equal(resumo.etapas[0].percentual, 66.7);
});

test('summarizeStepReach ignora evento sem sessão', () => {
  const resumo = summarizeStepReach(
    [{ session_id: null, event_name: 'anamnese_gerada' }],
    ['anamnese_gerada'],
  );

  assert.equal(resumo.totalSessoes, 0);
  assert.equal(resumo.etapas[0].sessoes, 0);
});

test('summarizeEventUsage ordena por volume e conta usuários distintos', () => {
  const resumo = summarizeEventUsage([
    { event_name: 'anamnese_gerada', user_id: 'u1', created_at: '2026-08-01' },
    { event_name: 'anamnese_gerada', user_id: 'u1', created_at: '2026-08-03' },
    { event_name: 'anamnese_gerada', user_id: 'u2', created_at: '2026-08-02' },
    { event_name: 'carta_gerada', user_id: 'u1', created_at: '2026-08-01' },
  ]);

  assert.equal(resumo[0].evento, 'anamnese_gerada');
  assert.equal(resumo[0].total, 3);
  assert.equal(resumo[0].usuarios, 2);
  assert.equal(resumo[0].ultimo, '2026-08-03');
});

// A armadilha real do modelo: affiliate_attributions grava uma linha POR
// TENTATIVA de checkout, então contar linhas superestima pessoas.
test('summarizeAffiliates conta pessoas distintas, não tentativas de checkout', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'gatti', status: 'active', commission_rate: 0.3 }],
    attributions: [
      { affiliate_id: 'a1', buyer_user_id: 'u1' },
      { affiliate_id: 'a1', buyer_user_id: 'u1' },
      { affiliate_id: 'a1', buyer_user_id: 'u2' },
    ],
    commissions: [
      { affiliate_id: 'a1', gross_amount: 24.9, commission_amount: 7.47, status: 'pending', created_at: new Date().toISOString() },
    ],
  });

  assert.equal(linha.checkoutsIniciados, 3);
  assert.equal(linha.compradoresDistintos, 2, 'duas pessoas, três tentativas');
  assert.equal(linha.conversoes, 1);
  assert.equal(linha.receitaGerada, 24.9);
  assert.equal(linha.taxaCheckoutParaPago, 50, '1 pago / 2 pessoas');
});

// "Sem denominador" e "0%" são coisas diferentes e não podem virar o mesmo
// número na tela.
test('summarizeAffiliates devolve null (não zero) quando não há denominador', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'novo', status: 'active', commission_rate: 0.3 }],
    attributions: [],
    commissions: [],
  });

  assert.equal(linha.taxaCheckoutParaPago, null);
  assert.equal(linha.conversoes, 0);
});

test('summarizeAffiliates ignora atribuição de afiliado inexistente', () => {
  const linhas = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'gatti', status: 'active', commission_rate: 0.3 }],
    attributions: [{ affiliate_id: 'fantasma', buyer_user_id: 'u1' }],
    commissions: [],
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].checkoutsIniciados, 0);
});

test('countAffiliateVisits conta sessões distintas por código', () => {
  const visitas = countAffiliateVisits([
    { event_name: 'afiliado_link_visita', session_id: 's1', metadata: { ref: 'gatti' } },
    // mesma sessão recarregando não pode inflar
    { event_name: 'afiliado_link_visita', session_id: 's1', metadata: { ref: 'gatti' } },
    { event_name: 'afiliado_link_visita', session_id: 's2', metadata: { ref: 'GATTI' } },
    { event_name: 'afiliado_link_visita', session_id: 's3', metadata: { ref: 'lucas' } },
    // ruído que não deve contar
    { event_name: 'anamnese_gerada', session_id: 's4', metadata: { ref: 'gatti' } },
    { event_name: 'afiliado_link_visita', session_id: 's5', metadata: {} },
    { event_name: 'afiliado_link_visita', session_id: null, metadata: { ref: 'gatti' } },
  ]);

  assert.equal(visitas.get('gatti'), 2, 'caixa alta é o mesmo código; reload não conta duas vezes');
  assert.equal(visitas.get('lucas'), 1);
  assert.equal(visitas.size, 2);
});

test('summarizeAffiliates calcula a conversão de ponta a ponta a partir das visitas', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'gatti', status: 'active', commission_rate: 0.3 }],
    attributions: [{ affiliate_id: 'a1', buyer_user_id: 'u1' }],
    commissions: [
      { affiliate_id: 'a1', gross_amount: 24.9, commission_amount: 7.47, status: 'pending', created_at: new Date().toISOString() },
    ],
    visitsByCode: new Map([['gatti', 20]]),
  });

  assert.equal(linha.visitas, 20);
  assert.equal(linha.taxaVisitaParaPago, 5, '1 pago / 20 visitas');
  assert.equal(linha.taxaCheckoutParaPago, 100, '1 pago / 1 pessoa que abriu checkout');
});

test('sem visitas medidas a taxa de ponta a ponta é null, não zero', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'gatti', status: 'active', commission_rate: 0.3 }],
    attributions: [],
    commissions: [],
    visitsByCode: new Map(),
  });

  assert.equal(linha.visitas, 0);
  assert.equal(linha.taxaVisitaParaPago, null);
});

test('token do painel assina, valida e recusa adulteração', () => {
  process.env.ADMIN_SYNC_SECRET = 'segredo-de-teste';

  const token = createOwnerMetricsToken(60000);
  assert.ok(token && token.sig, 'deveria gerar token');
  assert.equal(verifyOwnerMetricsToken(token), true);

  assert.equal(verifyOwnerMetricsToken({ exp: token.exp, sig: 'x'.repeat(64) }), false, 'assinatura errada');
  assert.equal(verifyOwnerMetricsToken({ exp: token.exp + 1, sig: token.sig }), false, 'exp adulterado invalida');
  assert.equal(verifyOwnerMetricsToken({ exp: Date.now() - 1000, sig: token.sig }), false, 'expirado');
  assert.equal(verifyOwnerMetricsToken({ exp: token.exp, sig: '' }), false);

  delete process.env.ADMIN_SYNC_SECRET;
});

test('sem segredo configurado o token não é gerado nem aceito', () => {
  delete process.env.ADMIN_SYNC_SECRET;
  delete process.env.OWNER_METRICS_SECRET;

  assert.equal(createOwnerMetricsToken(), null);
  assert.equal(verifyOwnerMetricsToken({ exp: Date.now() + 1000, sig: 'a'.repeat(64) }), false);
});

// --- ativação e janelas de tempo ------------------------------------------

test('summarizeActivation separa quem nunca usou de quem usou', () => {
  const agora = new Date('2026-09-02T12:00:00Z');
  const recente = new Date(agora.getTime() - 5 * 86400000).toISOString();
  const antigo = new Date(agora.getTime() - 90 * 86400000).toISOString();

  const resumo = summarizeActivation({
    profiles: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }, { id: 'u4' }],
    anamneses: [
      // u1: uso leve e recente
      { user_id: 'u1', created_at: recente },
      // u2: uso forte, mas parou
      ...Array.from({ length: 6 }, () => ({ user_id: 'u2', created_at: antigo })),
      // u3: uso leve e antigo
      { user_id: 'u3', created_at: antigo },
      // u4 nao aparece: criou conta e nunca usou
    ],
    now: agora,
  });

  assert.equal(resumo.contas, 4);
  assert.equal(resumo.semUso, 1);
  assert.equal(resumo.usoLeve, 2, 'u1 e u3');
  assert.equal(resumo.usoForte, 1, 'u2 com 6 anamneses');
  assert.equal(resumo.ativos30d, 1, 'so u1');
  assert.equal(resumo.dormentes, 2, 'u2 e u3 usaram e pararam');
  assert.equal(resumo.taxaAtivacao, 75, '3 de 4 chegaram a usar');
});

test('summarizeActivation devolve taxa null sem contas', () => {
  const resumo = summarizeActivation({ profiles: [], anamneses: [] });

  assert.equal(resumo.taxaAtivacao, null, 'sem denominador nao e 0%');
  assert.equal(resumo.contas, 0);
});

// Bordas de janela sao o tipo de erro que passa despercebido e envergonha
// depois, porque o numero fica *quase* certo.
test('countDistinctByWindow respeita a borda dos 7 dias', () => {
  const agora = new Date('2026-09-02T12:00:00Z');
  const dentro = new Date(agora.getTime() - 7 * 86400000 + 60000).toISOString();
  const fora = new Date(agora.getTime() - 7 * 86400000 - 60000).toISOString();

  const contagem = countDistinctByWindow(
    [
      { id: 'a', quando: dentro },
      { id: 'b', quando: fora },
    ],
    { chave: 'id', data: 'quando', now: agora },
  );

  assert.equal(contagem.sete, 1, '7 dias e 1 minuto atras esta fora');
  assert.equal(contagem.trinta, 2, 'mas ambos entram em 30 dias');
});

test('countDistinctByWindow conta cada id uma vez e ignora linha invalida', () => {
  const agora = new Date('2026-09-02T12:00:00Z');
  const recente = new Date(agora.getTime() - 3600000).toISOString();

  const contagem = countDistinctByWindow(
    [
      { id: 's1', quando: recente },
      { id: 's1', quando: recente },
      { id: null, quando: recente },
      { id: 's2', quando: null },
      { id: 's3', quando: 'data-invalida' },
    ],
    { chave: 'id', data: 'quando', now: agora },
  );

  assert.equal(contagem.trinta, 1, 'so s1; repetido conta uma vez');
});

// "Hoje" tem que virar a meia-noite de Brasilia. Em UTC o dia viraria as 21h
// e o numero do painel zerava no meio da noite de quem esta lendo.
test('a janela de hoje usa a meia-noite de Brasilia, nao a de UTC', () => {
  // 02/09 02:00 UTC = 01/09 23:00 em Brasilia: ainda e "ontem" para o leitor.
  const agora = new Date('2026-09-02T02:00:00Z');
  const janelas = buildWindows(agora);
  const inicioDoDia = new Date(janelas.hoje);

  assert.equal(inicioDoDia.toISOString(), '2026-09-01T03:00:00.000Z',
    'meia-noite de 01/09 em Brasilia');

  // Evento das 01:00 UTC de 02/09 = 22:00 de 01/09 em Brasilia: conta em hoje.
  const contagem = countDistinctByWindow(
    [{ id: 'x', quando: '2026-09-02T01:00:00Z' }],
    { chave: 'id', data: 'quando', now: agora },
  );

  assert.equal(contagem.hoje, 1);
});

test('summarizeReturn separa quem ainda nao tem carimbo', () => {
  const agora = new Date('2026-09-02T12:00:00Z');

  const resumo = summarizeReturn([
    { id: 'u1', last_seen_at: new Date(agora.getTime() - 3600000).toISOString() },
    { id: 'u2', last_seen_at: new Date(agora.getTime() - 10 * 86400000).toISOString() },
    { id: 'u3', last_seen_at: null },
    { id: 'u4' },
  ], agora);

  assert.equal(resumo.hoje, 1);
  assert.equal(resumo.trinta, 2);
  assert.equal(resumo.semRegistro, 2, 'coluna nova comeca vazia');
});
