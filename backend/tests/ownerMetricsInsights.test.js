const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  DICAS,
  summarizeAdoption,
  summarizeAiLatency,
  summarizeTips,
  summarizeTopTemplates,
  summarizeTrialCohorts,
  summarizeWeek,
} = require('../services/ownerMetricsInsights');
const { summarizeAffiliates, summarizeProfiles } = require('../services/ownerMetrics');

const AGORA = new Date('2026-11-05T15:00:00Z');
const dias = (n) => new Date(AGORA.getTime() - n * 86400000).toISOString();

test('resumo da semana compara 7 dias com os 7 anteriores, com receita só do aprovado processado', () => {
  const resumo = summarizeWeek({
    now: AGORA,
    profiles: [{ created_at: dias(1) }, { created_at: dias(2) }, { created_at: dias(9) }],
    events: [
      { event_name: 'anamnese_gerada', user_id: 'a', created_at: dias(1) },
      { event_name: 'anamnese_gerada', user_id: 'a', created_at: dias(3) },
      { event_name: 'anamnese_gerada', user_id: null, created_at: dias(2) },
      { event_name: 'hipoteses_diagnosticas_geradas', user_id: 'a', created_at: dias(10) },
    ],
    payments: [
      { status: 'approved', processed_at: dias(1), amount: 116.91, created_at: dias(1) },
      { status: 'approved', processed_at: null, amount: 50, created_at: dias(2) },
      { status: 'refunded', processed_at: dias(8), amount: 64.95, created_at: dias(8) },
    ],
  });
  const por = Object.fromEntries(resumo.map((r) => [r.id, r]));

  assert.equal(por.cadastros.atual, 2);
  assert.equal(por.cadastros.anterior, 1);
  assert.equal(por.contasOrganizaram.atual, 1);
  assert.equal(por.anamneses.atual, 3);
  assert.equal(por.hipoteses.atual, 0);
  assert.equal(por.hipoteses.anterior, 1);
  assert.equal(por.pagamentos.atual, 1);
  assert.equal(por.receita.atual, 116.91);
  assert.equal(por.receita.anterior, 0);
  assert.equal(por.cadastros.variacao.direcao, 'sobe');
});

test('funil do teste Pro agrupa por mês de cadastro e separa em teste, expirou e pagou', () => {
  const coortes = summarizeTrialCohorts({
    now: AGORA,
    profiles: [
      // pagou pelo pagamento aprovado
      { id: 'p1', created_at: '2026-10-03T12:00:00Z', trial_started_at: '2026-10-03', access_source: 'paid', current_plan: 'pro', plan_expires_at: dias(-100) },
      // ainda no teste
      { id: 'p2', created_at: '2026-11-02T12:00:00Z', trial_started_at: '2026-11-02', access_source: 'trial', current_plan: 'pro', plan_expires_at: dias(-3) },
      // teste acabou, não pagou
      { id: 'p3', created_at: '2026-10-10T12:00:00Z', trial_started_at: '2026-10-10', access_source: 'trial', current_plan: 'basic', plan_expires_at: dias(10) },
      // nunca iniciou teste (não entra em expirou)
      { id: 'p4', created_at: '2026-10-20T12:00:00Z', trial_started_at: null, access_source: 'none', current_plan: 'basic' },
    ],
    events: [{ event_name: 'anamnese_gerada', user_id: 'p3', created_at: dias(20) }],
    usos: [{ user_id: 'p1', action: 'trial_diagnostic_hypotheses', created_at: dias(30) }],
    payments: [{ status: 'approved', processed_at: dias(30), user_id: 'p1', amount: 116.91, created_at: dias(30) }],
  });

  assert.deepEqual(coortes.map((c) => c.mes), ['2026-11', '2026-10']);
  const outubro = coortes[1];
  assert.equal(outubro.entraram, 3);
  assert.equal(outubro.usaram, 2);
  assert.equal(outubro.usaramPro, 1);
  assert.equal(outubro.emTeste, 0);
  assert.equal(outubro.expiraramSemPagar, 1);
  assert.equal(outubro.pagaram, 1);
  assert.equal(outubro.taxaPagamento, 33.3);
  assert.equal(coortes[0].emTeste, 1);
});

test('adoção conta contas por função em % das ativas e nos últimos 7 dias', () => {
  const adocao = summarizeAdoption({
    now: AGORA,
    events: [
      { event_name: 'anamnese_gerada', user_id: 'a', created_at: dias(1) },
      { event_name: 'anamnese_gerada', user_id: 'b', created_at: dias(20) },
      { event_name: 'frase_pronta_usada', user_id: 'a', created_at: dias(2) },
      { event_name: 'interacao_arroba_usada', user_id: 'c', created_at: dias(1) },
      { event_name: 'site_visita', user_id: 'z', created_at: dias(1) },
    ],
    usos: [
      { user_id: 'b', action: 'trial_diagnostic_hypotheses', created_at: dias(15) },
      { user_id: 'b', action: 'trial_diagnostic_hypotheses', created_at: dias(14) },
    ],
  });
  const por = Object.fromEntries(adocao.funcoes.map((f) => [f.id, f]));

  assert.equal(adocao.contasAtivas, 3);
  assert.equal(por.organizar.contas, 2);
  assert.equal(por.organizar.pctDasAtivas, 66.7);
  assert.equal(por.organizar.contas7d, 1);
  assert.equal(por.hipoteses.contas, 1);
  assert.equal(por.frases.contas, 1);
  assert.equal(por.arroba.contas, 1);
  assert.equal(por.cartas.contas, 0);
  assert.equal(por.cartas.pctDasAtivas, 0);
});

test('modelos mais usados vêm do metadata do evento, só nos últimos 30 dias', () => {
  const top = summarizeTopTemplates([
    { event_name: 'anamnese_gerada', metadata: { template: 'clinica_medica' }, created_at: dias(1) },
    { event_name: 'anamnese_gerada', metadata: { template: 'clinica_medica' }, created_at: dias(2) },
    { event_name: 'anamnese_gerada', metadata: { template: 'upa_emergencia' }, created_at: dias(3) },
    { event_name: 'anamnese_gerada', metadata: {}, created_at: dias(4) },
    { event_name: 'anamnese_gerada', metadata: { template: 'geriatria' }, created_at: dias(40) },
  ], { now: AGORA });

  assert.equal(top.total, 4);
  assert.deepEqual(top.templates.map((t) => [t.template, t.vezes, t.pct]), [
    ['clinica_medica', 2, 50],
    ['(sem modelo)', 1, 25],
    ['upa_emergencia', 1, 25],
  ]);
});

test('dicas: exibida, entendi e uso da função nos 7 dias seguintes', () => {
  const dicas = summarizeTips({
    events: [
      { event_name: 'dica_exibida', user_id: 'a', metadata: { dica: 'frases_prontas' }, created_at: dias(5) },
      { event_name: 'dica_exibida', user_id: 'b', metadata: { dica: 'frases_prontas' }, created_at: dias(5) },
      { event_name: 'dica_concluida', user_id: 'a', metadata: { dica: 'frases_prontas' }, created_at: dias(5) },
      { event_name: 'dica_concluida', user_id: 'b', metadata: { dica: 'frases_prontas' }, created_at: dias(5) },
      // usou dentro de 7 dias: conta
      { event_name: 'frase_pronta_usada', user_id: 'a', created_at: dias(4) },
      // usou ANTES da dica: não conta
      { event_name: 'frase_pronta_usada', user_id: 'b', created_at: dias(9) },
      { event_name: 'dica_concluida', user_id: 'c', metadata: { dica: 'hipoteses' }, created_at: dias(3) },
      { event_name: 'dica_concluida', user_id: 'c', metadata: { dica: 'inexistente' }, created_at: dias(3) },
    ],
    usos: [{ user_id: 'c', action: 'trial_diagnostic_hypotheses', created_at: dias(2) }],
  });
  const por = Object.fromEntries(dicas.map((d) => [d.id, d]));

  assert.equal(por.frases_prontas.exibidas, 2);
  assert.equal(por.frases_prontas.pessoasExibidas, 2);
  assert.equal(por.frases_prontas.concluidas, 2);
  assert.equal(por.frases_prontas.usaramDepois, 1);
  assert.equal(por.frases_prontas.taxaUsoDepois, 50);
  assert.equal(por.hipoteses.usaramDepois, 1);
  assert.equal(por.cartas.exibidas, 0);
  assert.equal(por.cartas.taxaUsoDepois, null);
});

test('a lista de dicas do painel bate com a do frontend', async () => {
  const modulo = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'productTips.js')).href;
  const { PRODUCT_TIP_IDS } = await import(modulo);

  assert.deepEqual(DICAS.map((d) => d.id).sort(), [...PRODUCT_TIP_IDS].sort());
});

test('latência das hipóteses: mediana e p90 por janela, ignorando registro sem tempo', () => {
  const lat = summarizeAiLatency([
    { action: 'trial_diagnostic_hypotheses', metadata: { durationMs: 12000 }, created_at: dias(1) },
    { action: 'trial_diagnostic_hypotheses', metadata: { durationMs: 15000 }, created_at: dias(2) },
    { action: 'trial_diagnostic_hypotheses', metadata: { durationMs: 25000 }, created_at: dias(3) },
    { action: 'trial_diagnostic_hypotheses', metadata: {}, created_at: dias(3) },
    { action: 'trial_diagnostic_hypotheses', metadata: { durationMs: 9000 }, created_at: dias(20) },
    { action: 'trial_prescription_guide', metadata: { durationMs: 1 }, created_at: dias(1) },
  ], { now: AGORA });

  assert.equal(lat.hipoteses.ultimos7.amostras, 3);
  assert.equal(lat.hipoteses.ultimos7.p50Ms, 15000);
  assert.equal(lat.hipoteses.ultimos7.p90Ms, 25000);
  assert.equal(lat.hipoteses.ultimos7.acimaDe20s, 1);
  assert.equal(lat.hipoteses.ultimos30.amostras, 4);
  assert.equal(summarizeAiLatency([], { now: AGORA }).hipoteses.ultimos7.p50Ms, null);
});

test('afiliados: comissão cancelada (estorno ou teste) não é venda nem receita', () => {
  const [linha] = summarizeAffiliates({
    affiliates: [{ id: 'af', code: 'dono', status: 'active', commission_rate: 0.2 }],
    attributions: [],
    commissions: [
      { affiliate_id: 'af', gross_amount: 116.91, commission_amount: 35.07, status: 'paid' },
      { affiliate_id: 'af', gross_amount: 64.95, commission_amount: 12.99, status: 'cancelled' },
      { affiliate_id: 'af', gross_amount: 12.45, commission_amount: 2.49, status: 'cancelled' },
    ],
  });

  assert.equal(linha.conversoes, 1);
  assert.equal(linha.receitaGerada, 116.91);
});

test('perfis: Pro vigente separa quem está no teste grátis de quem pagou', () => {
  const futuro = dias(-5);
  const resumo = summarizeProfiles([
    { current_plan: 'pro', billing_status: 'active', access_source: 'trial', plan_expires_at: futuro },
    { current_plan: 'pro', billing_status: 'active', access_source: 'paid', plan_expires_at: futuro },
    { current_plan: 'pro', billing_status: 'active', access_source: 'none', plan_expires_at: null },
    { current_plan: 'pro', billing_status: 'active', access_source: 'trial', plan_expires_at: dias(2) },
  ]);

  assert.equal(resumo.proVigente, 3);
  assert.equal(resumo.emTesteAgora, 1);
  assert.equal(resumo.proPago, 2);
  assert.equal(resumo.basico, 1);
});
