const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  buildWarnings,
  buildWindows,
  compareChange,
  countAffiliateVisits,
  countDistinctByWindow,
  countLinkedAccounts,
  fetchAllPages,
  PAGE_SIZE,
  parseContentRange,
  summarizeActivation,
  summarizeAffiliates,
  summarizeEventUsage,
  summarizeGrowth,
  summarizeOrganizations,
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

// A ativação vem dos eventos de organização, NÃO da tabela `anamneses`, que só
// registra quem pede avaliação. Medido em 11/09/2026: 34 contas tinham
// organizado pelos eventos, 14 apareciam na tabela.
test('summarizeActivation conta quem organizou pelos eventos', () => {
  const agora = new Date('2026-09-02T12:00:00Z');
  const recente = new Date(agora.getTime() - 5 * 86400000).toISOString();
  const antigo = new Date(agora.getTime() - 90 * 86400000).toISOString();
  const organizou = (user, quando, sessao = `s-${user}`) => ({
    event_name: 'anamnese_gerada', user_id: user, session_id: sessao, created_at: quando,
  });

  const resumo = summarizeActivation({
    profiles: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }, { id: 'u4' }],
    events: [
      // u1: uso leve e recente
      organizou('u1', recente),
      // u2: uso forte, mas parou
      ...Array.from({ length: 6 }, () => organizou('u2', antigo)),
      // u3: uso leve e antigo
      organizou('u3', antigo),
      // u4 só visitou: evento que não é organização não conta
      { event_name: 'site_visita', user_id: 'u4', session_id: 's-u4', created_at: recente },
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
  const resumo = summarizeActivation({ profiles: [], events: [] });

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

// --- Content-Range e aviso de truncamento ---------------------------------
//
// Bug real que motivou isto: a tabela events passou de 1000 linhas, o Max
// Rows do projeto no Supabase cortou em 1000 sem avisar, e sem `order` o
// corte pegou justo os eventos mais recentes (incluindo visitas de afiliado
// do dia). O aviso antigo comparava contra o teto que o próprio código pede
// (5000), que nunca é o que bate de verdade — por isso nunca disparava.

test('parseContentRange le uma leitura parcial', () => {
  assert.deepEqual(parseContentRange('0-999/1168'), { returned: 1000, total: 1168 });
});

test('parseContentRange le uma leitura completa', () => {
  assert.deepEqual(parseContentRange('0-5/6'), { returned: 6, total: 6 });
});

test('parseContentRange le resultado vazio', () => {
  assert.deepEqual(parseContentRange('*/0'), { returned: 0, total: 0 });
});

test('parseContentRange devolve null para cabecalho ausente ou invalido', () => {
  assert.equal(parseContentRange(null), null);
  assert.equal(parseContentRange(''), null);
  assert.equal(parseContentRange('lixo'), null);
});

test('buildWarnings aponta a tabela truncada pelo nome, nao pelo teto do codigo', () => {
  const avisos = buildWarnings({ tabelasTruncadas: ['eventos'] });

  assert.ok(
    avisos.some((aviso) => aviso.includes('eventos') && aviso.includes('teto de linhas')),
    'precisa nomear a tabela cortada',
  );
});

test('buildWarnings nao avisa truncamento quando nada foi cortado', () => {
  const avisos = buildWarnings({ tabelasTruncadas: [] });

  assert.ok(!avisos.some((aviso) => aviso.includes('teto de linhas')));
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

// --- contas vinculadas por afiliado -------------------------------------------

test('countLinkedAccounts conta contas por afiliado e ignora quem não tem indicação', () => {
  const porAfiliado = countLinkedAccounts([
    { id: 'u1', referred_by_affiliate_id: 'af-matheus' },
    { id: 'u2', referred_by_affiliate_id: 'af-matheus' },
    { id: 'u3', referred_by_affiliate_id: 'af-joseph' },
    { id: 'u4', referred_by_affiliate_id: null },
    { id: 'u5' },
  ]);

  assert.equal(porAfiliado.get('af-matheus'), 2);
  assert.equal(porAfiliado.get('af-joseph'), 1);
  assert.equal(porAfiliado.size, 2, 'conta sem indicação não entra');
});

// Caso real: 24 cadastros do TikTok do Matheus, nenhum pelo link. Sem esta
// coluna o quadro dele mostrava zero em tudo e ele ficava no fim da lista,
// atrás de quem só tinha visita.
test('summarizeAffiliates mostra contas vinculadas e ordena por elas antes das visitas', () => {
  const linhas = summarizeAffiliates({
    affiliates: [
      { id: 'af-joseph', code: 'joseph', status: 'active', commission_rate: 0.3 },
      { id: 'af-matheus', code: 'matheusmacari', status: 'active', commission_rate: 0.3 },
    ],
    attributions: [],
    commissions: [],
    visitsByCode: new Map([['joseph', 16]]),
    linkedByAffiliate: new Map([['af-matheus', 24]]),
  });

  assert.equal(linhas[0].codigo, 'matheusmacari');
  assert.equal(linhas[0].contasVinculadas, 24);
  assert.equal(linhas[1].contasVinculadas, 0);
});

test('summarizeAffiliates sem vínculos informados devolve zero, não quebra', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'a1', code: 'x', status: 'active', commission_rate: 0.3 }],
    attributions: [],
    commissions: [],
  });

  assert.equal(linha.contasVinculadas, 0);
});

// Quem organizou sem conta e criou conta na mesma sessão é a mesma pessoa.
test('summarizeActivation credita quem organizou antes de logar, na mesma sessão', () => {
  const agora = new Date('2026-09-11T18:00:00Z');
  const cedo = '2026-09-11T13:00:00Z';

  const resumo = summarizeActivation({
    profiles: [{ id: 'u5' }, { id: 'u6' }],
    events: [
      { event_name: 'anamnese_gerada', user_id: null, session_id: 'sa', created_at: cedo },
      { event_name: 'site_visita', user_id: 'u5', session_id: 'sa', created_at: cedo },
    ],
    now: agora,
  });

  assert.equal(resumo.usoLeve, 1, 'u5 organizou antes de logar');
  assert.equal(resumo.semUso, 1, 'u6 nunca organizou');
});

test('summarizeOrganizations separa total de organizações e contas', () => {
  const resumo = summarizeOrganizations([
    { event_name: 'anamnese_gerada', user_id: 'u1', session_id: 's1' },
    { event_name: 'anamnese_gerada', user_id: 'u1', session_id: 's1' },
    { event_name: 'anamnese_gerada', user_id: null, session_id: 'anon' },
    { event_name: 'site_visita', user_id: 'u2', session_id: 's2' },
  ]);

  assert.equal(resumo.total, 3, 'conta organização anônima também');
  assert.equal(resumo.contas, 1, 'só u1 tem conta');
});

test('summarizeOrganizations não conta conta apagada, para bater com a ativação', () => {
  const resumo = summarizeOrganizations(
    [
      { event_name: 'anamnese_gerada', user_id: 'u1', session_id: 's1' },
      { event_name: 'anamnese_gerada', user_id: 'apagada', session_id: 's2' },
    ],
    [{ id: 'u1' }],
  );

  assert.equal(resumo.total, 2, 'a organização aconteceu, fica no total');
  assert.equal(resumo.contas, 1, 'mas a conta apagada não entra em contas');
});

// --- crescimento --------------------------------------------------------------

const SO_CADASTROS = [{ id: 'cadastros', rotulo: 'Cadastros', fonte: 'profiles', data: 'created_at' }];

// Comparar o dia parcial com o ontem inteiro faria toda tarde parecer queda.
test('crescimento compara hoje com ontem ATÉ A MESMA HORA, não com o ontem inteiro', () => {
  // 11/09 15:00 em Brasília
  const agora = new Date('2026-09-11T18:00:00Z');
  const profiles = [
    ...Array.from({ length: 3 }, () => ({ created_at: '2026-09-11T13:00:00Z' })), // hoje 10h
    { created_at: '2026-09-10T13:00:00Z' }, // ontem 10h: antes da mesma hora
    ...Array.from({ length: 5 }, () => ({ created_at: '2026-09-10T23:00:00Z' })), // ontem 20h: depois
  ];

  const [c] = summarizeGrowth({ fontes: { profiles }, now: agora, metricas: SO_CADASTROS });

  assert.equal(c.hoje, 3);
  assert.equal(c.ontemAteAgora, 1, 'os 5 de ontem às 20h ainda não "aconteceram" nesta hora');
  assert.deepEqual(c.variacaoDia, { delta: 2, percentual: 200, direcao: 'sobe' });
});

test('crescimento da semana compara dois períodos do mesmo tamanho', () => {
  const agora = new Date('2026-09-11T18:00:00Z');
  const diasAtras = (n) => new Date(agora.getTime() - n * 86400000).toISOString();
  const profiles = [
    ...[1, 2, 3, 6].map((n) => ({ created_at: diasAtras(n) })),
    ...[8, 13].map((n) => ({ created_at: diasAtras(n) })),
    { created_at: diasAtras(15) }, // fora das duas janelas
  ];

  const [c] = summarizeGrowth({ fontes: { profiles }, now: agora, metricas: SO_CADASTROS });

  assert.equal(c.ultimos7, 4);
  assert.equal(c.anteriores7, 2);
  assert.deepEqual(c.variacaoSemana, { delta: 2, percentual: 100, direcao: 'sobe' });
});

test('a série tem 14 dias e cada item cai no dia certo de Brasília', () => {
  const agora = new Date('2026-09-11T18:00:00Z');
  // 11/09 01:00 UTC = 10/09 22:00 em Brasília: é barra de ontem, não de hoje.
  const profiles = [{ created_at: '2026-09-11T01:00:00Z' }];

  const [c] = summarizeGrowth({ fontes: { profiles }, now: agora, metricas: SO_CADASTROS });

  assert.equal(c.serie.length, 14);
  assert.equal(c.serie[13].valor, 0, 'hoje');
  assert.equal(c.serie[12].valor, 1, 'ontem');
  assert.equal(c.serie[13].dia, '2026-09-11T03:00:00.000Z', 'meia-noite de hoje em Brasília');
});

test('visitas sem conta contam sessões distintas e ignoram quem está logado', () => {
  const agora = new Date('2026-09-11T18:00:00Z');
  const hora = '2026-09-11T15:00:00Z';
  const events = [
    { event_name: 'site_visita', session_id: 's1', metadata: { logado: false }, created_at: hora },
    { event_name: 'site_visita', session_id: 's1', metadata: { logado: false }, created_at: hora },
    { event_name: 'site_visita', session_id: 's2', metadata: { logado: 'false' }, created_at: hora },
    { event_name: 'site_visita', session_id: 's3', metadata: { logado: true }, created_at: hora },
  ];

  const visitas = summarizeGrowth({ fontes: { events }, now: agora }).find((c) => c.id === 'visitas');

  assert.equal(visitas.hoje, 2, 's1 recarregou (1 sessão), s2 conta, s3 estava logado');
});

test('variação sem base anterior não inventa porcentagem', () => {
  assert.deepEqual(compareChange(5, 0), { delta: 5, percentual: null, direcao: 'sobe' });
  assert.deepEqual(compareChange(0, 0), { delta: 0, percentual: null, direcao: 'igual' });
  assert.deepEqual(compareChange(2, 4), { delta: -2, percentual: -50, direcao: 'desce' });
});

// --- paginação ----------------------------------------------------------------
//
// O teto de 1000 linhas do Supabase já cortava os eventos (1.876 em 11/09).

function paginasFalsas(todas) {
  const pedidos = [];
  const fetchPage = async (cursor) => {
    pedidos.push(cursor);
    const restantes = cursor ? todas.filter((linha) => linha.created_at < cursor) : todas;
    return { rows: restantes.slice(0, PAGE_SIZE), total: restantes.length };
  };
  return { fetchPage, pedidos };
}

function linhasDecrescentes(quantidade) {
  const base = Date.UTC(2026, 8, 11);
  return Array.from({ length: quantidade }, (_, i) => ({ id: i, created_at: new Date(base - i * 1000).toISOString() }));
}

test('fetchAllPages segue o cursor até o fim, sem repetir nem perder linha', async () => {
  const todas = linhasDecrescentes(2500);
  const { fetchPage, pedidos } = paginasFalsas(todas);

  const resultado = await fetchAllPages(fetchPage);

  assert.equal(resultado.rows.length, 2500);
  assert.equal(new Set(resultado.rows.map((linha) => linha.id)).size, 2500, 'nenhuma linha repetida');
  assert.equal(resultado.truncated, false);
  assert.equal(pedidos.length, 3, '1000 + 1000 + 500');
});

test('fetchAllPages marca como parcial quando bate no teto de páginas', async () => {
  const { fetchPage } = paginasFalsas(linhasDecrescentes(2500));

  const resultado = await fetchAllPages(fetchPage, { maxPages: 2 });

  assert.equal(resultado.rows.length, 2000);
  assert.equal(resultado.truncated, true);
});

test('fetchAllPages devolve null se a primeira página falhar', async () => {
  assert.equal(await fetchAllPages(async () => null), null);
});
