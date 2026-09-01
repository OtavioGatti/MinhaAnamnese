// Métricas agregadas do site para o painel do dono.
//
// Só leitura. Nenhuma função daqui escreve no banco.
//
// Privacidade: nada aqui seleciona e-mail, nome ou texto de anamnese. As
// consultas trazem apenas as colunas necessárias para contar e somar — o
// painel mostra agregados, nunca pessoas.
//
// Escala: hoje o site tem dezenas de perfis e centenas de eventos, então
// buscar as linhas e agregar em JS é mais simples e mais barato de manter do
// que espalhar `count=exact` por toda parte. Os tetos abaixo existem para que
// isso degrade de forma visível (ver `truncated`) em vez de silenciosamente
// mentir quando a base crescer.

const { buildFunnelMetrics, getZeroFunnelMetrics } = require('./funnelMetrics');
const { getGlobalFunnelSessions } = require('./funnelTracking');
const { FUNNEL_STEPS } = require('../utils/funnel');
const { summarizeAffiliateCommissions } = require('./affiliates');

const ROW_LIMIT = 5000;

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isOwnerMetricsStorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

async function selectRows(table, params = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return [];
  }

  const query = new URLSearchParams({ limit: String(ROW_LIMIT), ...params });
  const response = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, {
    method: 'GET',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return Array.isArray(json) ? json : [];
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isFutureOrNull(value) {
  return !value || new Date(value).getTime() > Date.now();
}

// --- agregações puras (testáveis sem banco) -------------------------------

function summarizeProfiles(profiles) {
  const total = profiles.length;
  let comTrial = 0;
  let proVigente = 0;
  let afiliadoCortesia = 0;
  let basico = 0;

  profiles.forEach((profile) => {
    const plano = String(profile.current_plan || 'basic').toLowerCase();

    if (profile.trial_started_at) {
      comTrial += 1;
    }

    if (plano === 'affiliate' || plano === 'afiliado') {
      afiliadoCortesia += 1;
      return;
    }

    if (plano === 'pro' && profile.billing_status === 'active' && isFutureOrNull(profile.plan_expires_at)) {
      proVigente += 1;
      return;
    }

    basico += 1;
  });

  return { total, comTrial, proVigente, afiliadoCortesia, basico };
}

function summarizePayments(payments) {
  const aprovados = payments.filter((p) => p.status === 'approved');
  const reembolsados = payments.filter((p) => p.status === 'refunded');

  return {
    aprovados: aprovados.length,
    reembolsados: reembolsados.length,
    recusados: payments.filter((p) => p.status === 'rejected').length,
    receitaBruta: roundMoney(aprovados.reduce((total, p) => total + (Number(p.amount) || 0), 0)),
    receitaEstornada: roundMoney(reembolsados.reduce((total, p) => total + (Number(p.amount) || 0), 0)),
    compradoresUnicos: new Set(aprovados.map((p) => p.user_id).filter(Boolean)).size,
  };
}

// Retenção medida por dias distintos com evento. Só enxerga quem aceitou
// cookies — quem recusa não emite evento nenhum, então isto é piso, não total.
function summarizeRetention(events) {
  const diasPorUsuario = new Map();

  events.forEach((event) => {
    if (!event.user_id || !event.created_at) {
      return;
    }

    const dia = String(event.created_at).slice(0, 10);
    const dias = diasPorUsuario.get(event.user_id) || new Set();
    dias.add(dia);
    diasPorUsuario.set(event.user_id, dias);
  });

  const contagens = [...diasPorUsuario.values()].map((dias) => dias.size);
  const soma = contagens.reduce((total, n) => total + n, 0);

  return {
    usuariosComEvento: contagens.length,
    umDiaSo: contagens.filter((n) => n === 1).length,
    doisATresDias: contagens.filter((n) => n >= 2 && n <= 3).length,
    quatroOuMais: contagens.filter((n) => n >= 4).length,
    mediaDiasAtivos: contagens.length ? Math.round((soma / contagens.length) * 10) / 10 : 0,
  };
}

// Alcance por etapa, IGNORANDO a ordem: quantas sessões dispararam cada evento
// do funil em algum momento.
//
// Existe porque o funil estrito (buildFunnelMetrics) exige a sequência exata e,
// na prática, o clique no CTA costuma vir ANTES do score — o que zerava as três
// últimas etapas. Um zero na tela do dono seria pior do que não mostrar nada.
// A definição estrita não foi alterada: ela é compartilhada com a tela do
// usuário e mudá-la é outra decisão.
function summarizeStepReach(events, steps) {
  const sessoesPorEtapa = new Map(steps.map((step) => [step, new Set()]));
  const todasSessoes = new Set();

  events.forEach((event) => {
    if (!event.session_id) {
      return;
    }

    todasSessoes.add(event.session_id);

    const sessoes = sessoesPorEtapa.get(event.event_name);

    if (sessoes) {
      sessoes.add(event.session_id);
    }
  });

  const total = todasSessoes.size;

  return {
    totalSessoes: total,
    etapas: steps.map((step) => {
      const alcance = sessoesPorEtapa.get(step).size;

      return {
        nome: step,
        sessoes: alcance,
        percentual: total ? Math.round((alcance / total) * 1000) / 10 : 0,
      };
    }),
  };
}

function summarizeEventUsage(events) {
  const porEvento = new Map();

  events.forEach((event) => {
    const nome = event.event_name;

    if (!nome) {
      return;
    }

    const atual = porEvento.get(nome) || { total: 0, usuarios: new Set(), ultimo: null };
    atual.total += 1;

    if (event.user_id) {
      atual.usuarios.add(event.user_id);
    }

    if (!atual.ultimo || event.created_at > atual.ultimo) {
      atual.ultimo = event.created_at;
    }

    porEvento.set(nome, atual);
  });

  return [...porEvento.entries()]
    .map(([nome, dados]) => ({
      evento: nome,
      total: dados.total,
      usuarios: dados.usuarios.size,
      ultimo: dados.ultimo ? String(dados.ultimo).slice(0, 10) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

// Visitas por código, a partir do evento afiliado_link_visita. Conta SESSÕES
// distintas: recarregar a página não infla o número. Só enxerga quem aceitou
// cookies — o evento é bloqueado antes do consentimento.
function countAffiliateVisits(events) {
  const sessoesPorCodigo = new Map();

  events.forEach((event) => {
    if (event.event_name !== 'afiliado_link_visita') {
      return;
    }

    const codigo = String(event.metadata?.ref || '').trim().toLowerCase();

    if (!codigo || !event.session_id) {
      return;
    }

    const sessoes = sessoesPorCodigo.get(codigo) || new Set();
    sessoes.add(event.session_id);
    sessoesPorCodigo.set(codigo, sessoes);
  });

  return new Map([...sessoesPorCodigo].map(([codigo, sessoes]) => [codigo, sessoes.size]));
}

/**
 * Quadro por afiliado.
 *
 * ATENÇÃO ao que cada número significa:
 * - `visitas` conta sessões distintas que chegaram pelo link. Só passou a
 *   existir quando o evento afiliado_link_visita foi instrumentado, então o
 *   histórico anterior é zero — não é queda, é ausência de medição.
 * - `checkoutsIniciados` conta linhas de affiliate_attributions, gravadas ao
 *   ABRIR o checkout, uma por tentativa. Por isso a contagem de PESSOAS usa
 *   buyer_user_id distinto.
 * - `conversoes` vem de affiliate_commissions, a única fonte confiável de
 *   pagamento (idempotente por payment_id).
 * - `taxaCheckoutParaPago` é etapa tardia e parece alta por isso;
 *   `taxaVisitaParaPago` é a de ponta a ponta, a que interessa à divulgação.
 */
function summarizeAffiliates({ affiliates, attributions, commissions, visitsByCode = new Map() }) {
  const porAfiliado = new Map(affiliates.map((a) => [a.id, {
    codigo: a.code,
    status: a.status,
    comissaoPercentual: Math.round((Number(a.commission_rate) || 0) * 1000) / 10,
    checkoutsIniciados: 0,
    compradoresDistintos: new Set(),
    conversoes: 0,
    receitaGerada: 0,
    comissaoTotal: 0,
  }]));

  attributions.forEach((attribution) => {
    const linha = porAfiliado.get(attribution.affiliate_id);

    if (!linha) {
      return;
    }

    linha.checkoutsIniciados += 1;

    if (attribution.buyer_user_id) {
      linha.compradoresDistintos.add(attribution.buyer_user_id);
    }
  });

  const comissoesPorAfiliado = new Map();

  commissions.forEach((commission) => {
    const lista = comissoesPorAfiliado.get(commission.affiliate_id) || [];
    lista.push(commission);
    comissoesPorAfiliado.set(commission.affiliate_id, lista);
  });

  comissoesPorAfiliado.forEach((lista, affiliateId) => {
    const linha = porAfiliado.get(affiliateId);

    if (!linha) {
      return;
    }

    // Reaproveita o somador já existente e testado do fluxo de repasse.
    const resumo = summarizeAffiliateCommissions(lista, new Map());
    linha.conversoes = resumo.conversions;
    linha.comissaoTotal = resumo.totalCommission;
    linha.receitaGerada = roundMoney(lista.reduce((t, c) => t + (Number(c.gross_amount) || 0), 0));
  });

  return [...porAfiliado.values()]
    .map((linha) => {
      const pessoas = linha.compradoresDistintos.size;
      const visitas = visitsByCode.get(String(linha.codigo || '').toLowerCase()) || 0;

      return {
        ...linha,
        compradoresDistintos: pessoas,
        visitas,
        // null em vez de 0 quando não há denominador: 0% e "sem dado" são
        // coisas diferentes e não podem virar o mesmo número no painel.
        taxaCheckoutParaPago: pessoas > 0
          ? Math.round((linha.conversoes / pessoas) * 1000) / 10
          : null,
        // Conversão de ponta a ponta, a que a divulgação realmente quer saber.
        // Só existe a partir de agora: antes não havia registro de visita.
        taxaVisitaParaPago: visitas > 0
          ? Math.round((linha.conversoes / visitas) * 1000) / 10
          : null,
      };
    })
    .sort((a, b) => b.receitaGerada - a.receitaGerada
      || b.visitas - a.visitas
      || b.checkoutsIniciados - a.checkoutsIniciados);
}

// --- composição -----------------------------------------------------------

async function getOwnerMetrics() {
  if (!isOwnerMetricsStorageAvailable()) {
    const erro = new Error('Métricas indisponíveis: Supabase não configurado.');
    erro.statusCode = 503;
    throw erro;
  }

  const [profiles, payments, events, anamneses, affiliates, attributions, commissions, funnel] =
    await Promise.all([
      selectRows('profiles', { select: 'current_plan,billing_status,plan_expires_at,trial_started_at,created_at' }),
      selectRows('billing_payments', { select: 'status,amount,user_id,created_at' }),
      selectRows('events', { select: 'user_id,session_id,event_name,metadata,created_at' }),
      selectRows('anamneses', { select: 'user_id' }),
      selectRows('affiliates', { select: 'id,code,status,commission_rate' }),
      selectRows('affiliate_attributions', { select: 'affiliate_id,buyer_user_id,created_at' }),
      selectRows('affiliate_commissions', { select: 'affiliate_id,gross_amount,commission_amount,status,payout_id,created_at' }),
      getGlobalFunnelSessions().catch(() => ({ sessions: [], truncated: false })),
    ]);

  const metricasFunil = funnel.sessions.length
    ? buildFunnelMetrics(funnel.sessions)
    : getZeroFunnelMetrics();
  const alcance = summarizeStepReach(events, FUNNEL_STEPS);
  // Quando o funil estrito perde etapas que o alcance mostra, é sinal de que a
  // ordem declarada não bate com o comportamento real — vale avisar em vez de
  // deixar o zero passar por resultado.
  const funilDivergente = metricasFunil.etapas.some((etapa, indice) => (
    etapa.total === 0 && (alcance.etapas[indice]?.sessoes || 0) > 0
  ));

  return {
    geradoEm: new Date().toISOString(),
    contas: summarizeProfiles(profiles),
    pagamentos: summarizePayments(payments),
    anamneses: {
      total: anamneses.length,
      usuariosDistintos: new Set(anamneses.map((a) => a.user_id).filter(Boolean)).size,
    },
    retencao: summarizeRetention(events),
    eventos: summarizeEventUsage(events),
    alcance,
    funil: metricasFunil,
    afiliados: summarizeAffiliates({
      affiliates,
      attributions,
      commissions,
      visitsByCode: countAffiliateVisits(events),
    }),
    avisos: buildWarnings({ events, funnelTruncated: funnel.truncated, funilDivergente }),
  };
}

// Ressalvas que precisam viajar junto com os números: sem elas o painel
// parece mais confiável do que é.
function buildWarnings({ events, funnelTruncated, funilDivergente }) {
  const avisos = [
    'Quem recusa o banner de cookies não emite evento nenhum — toda métrica de evento é piso, não total.',
    'Visitas por link de afiliado começaram a ser medidas em 31/08/2026: zero antes disso é ausência de medição, não queda. Como o evento respeita o consentimento de cookies, a visita de quem recusa não é contada.',
  ];

  if (funilDivergente) {
    avisos.push(
      'A ordem declarada do funil não bate com o uso real: há etapas com zero no funil estrito que aparecem no alcance. ' +
      'Use a tabela de alcance; o funil estrito só conta quem seguiu a sequência exata.',
    );
  }

  if (funnelTruncated) {
    avisos.push('O funil bateu no teto de eventos lidos e está parcial.');
  }

  if (events.length >= ROW_LIMIT) {
    avisos.push('A leitura de eventos bateu no teto: os números de uso e retenção estão parciais.');
  }

  return avisos;
}

module.exports = {
  getOwnerMetrics,
  isOwnerMetricsStorageAvailable,
  countAffiliateVisits,
  summarizeAffiliates,
  summarizeEventUsage,
  summarizePayments,
  summarizeProfiles,
  summarizeRetention,
  summarizeStepReach,
};
