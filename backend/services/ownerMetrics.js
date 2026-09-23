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
const { describeDeclineReason } = require('../utils/paymentDeclineReasons');

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

// Content-Range vem como "0-999/1168" (parcial), "0-5/6" (completo) ou "*/0"
// (vazio). É a ÚNICA forma de saber se algo cortou a leitura — o Max Rows do
// projeto no Supabase (hoje 1000 neste banco) sobrepõe silenciosamente
// qualquer `limit` maior pedido aqui, sem erro nenhum.
function parseContentRange(value) {
  if (!value) {
    return null;
  }

  const [range, totalRaw] = String(value).trim().split('/');
  const total = totalRaw === '*' ? null : Number(totalRaw);
  const totalValido = Number.isFinite(total) ? total : null;

  if (range === '*') {
    return { returned: 0, total: totalValido };
  }

  const [startRaw, endRaw] = range.split('-');
  const start = Number(startRaw);
  const end = Number(endRaw);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return { returned: end - start + 1, total: totalValido };
}

async function fetchPage(table, params) {
  const { url, serviceRoleKey } = getConfig();
  const query = new URLSearchParams({ limit: String(ROW_LIMIT), ...params });
  const response = await fetch(`${url}/rest/v1/${table}?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      // count=exact é o que faz o Content-Range vir com o total real de
      // linhas, não só o intervalo devolvido — sem isso não dá pra distinguir
      // "a tabela tem exatamente 1000 linhas" de "cortou em 1000".
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const rows = Array.isArray(json) ? json : [];
  const range = parseContentRange(response.headers.get('content-range'));

  return { rows, total: range?.total ?? null };
}

function isTruncated({ rows, total }) {
  return typeof total === 'number' && rows.length < total;
}

// O Max Rows do projeto no Supabase (hoje 1000) corta qualquer resposta, não
// importa o `limit` pedido. Com 1.876 eventos em 11/09/2026, o painel já
// calculava retenção, funil e uso por evento só sobre os 1.000 mais recentes
// — e uma comparação "7 dias contra os 7 anteriores" veria a semana antiga
// incompleta, inventando crescimento.
//
// Paginação por CURSOR DE DATA, não por deslocamento: o site grava eventos o
// tempo todo, e com offset uma linha nova empurraria as páginas seguintes,
// repetindo a última linha de cada uma. Com o cursor (created_at menor que o
// da última linha lida), linha nova nunca entra numa página posterior.
// Empate exato de created_at na fronteira seria pulado; com precisão de
// microssegundo e inserção uma a uma, não acontece na prática.
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

async function fetchAllPages(fetchPageFn, { maxPages = MAX_PAGES } = {}) {
  const rows = [];
  let total = null;
  let cursor = null;

  for (let pagina = 0; pagina < maxPages; pagina += 1) {
    const resultado = await fetchPageFn(cursor);

    if (!resultado) {
      // Falha no meio: o que veio antes vale, mas marcado como parcial.
      return pagina === 0 ? null : { rows, total, truncated: true };
    }

    // O total da PRIMEIRA página é o da tabela inteira; os seguintes, com o
    // cursor aplicado, contam só o que falta.
    if (pagina === 0 && typeof resultado.total === 'number') {
      total = resultado.total;
    }

    rows.push(...resultado.rows);

    // Não decide pelo tamanho da página: se o teto do servidor for menor que
    // PAGE_SIZE, uma página cheia pareceria a última e o resto sumiria calado.
    if (resultado.rows.length === 0 || (total !== null && rows.length >= total)) {
      return { rows, total, truncated: false };
    }

    cursor = resultado.rows[resultado.rows.length - 1].created_at;
  }

  return { rows, total, truncated: total === null || rows.length < total };
}

// Tabela ordenada por data (tudo que cresce) é lida inteira, página a página.
// As pequenas e sem ordem (affiliates) seguem numa leitura só.
async function fetchRows(table, params) {
  if (params.order !== 'created_at.desc') {
    const resultado = await fetchPage(table, params);
    return resultado ? { ...resultado, truncated: isTruncated(resultado) } : null;
  }

  return fetchAllPages((cursor) => fetchPage(table, {
    ...params,
    limit: String(PAGE_SIZE),
    ...(cursor ? { created_at: `lt.${cursor}` } : {}),
  }));
}

// `optionalColumns` cobre a janela entre o deploy e a aplicação manual do SQL:
// o PostgREST devolve 400 para coluna inexistente, e como aqui a falha vira
// lista vazia, UMA coluna nova zeraria o painel inteiro em silêncio. Nesse
// caso reconsulta sem ela e devolve `degraded`, para o painel avisar em vez de
// mostrar zero como se fosse resultado.
async function selectRows(table, params = {}, { optionalColumns = [] } = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return { rows: [], degraded: [], truncated: false };
  }

  const result = await fetchRows(table, params).catch(() => null);

  if (result) {
    return { rows: result.rows, degraded: [], truncated: result.truncated };
  }

  if (optionalColumns.length === 0 || !params.select) {
    return { rows: [], degraded: [], truncated: false };
  }

  const colunas = params.select.split(',');
  const restantes = colunas.filter((coluna) => !optionalColumns.includes(coluna.trim()));

  if (restantes.length === colunas.length) {
    return { rows: [], degraded: [], truncated: false };
  }

  const semOpcionais = await fetchRows(table, { ...params, select: restantes.join(',') })
    .catch(() => null);

  return {
    rows: semOpcionais?.rows || [],
    degraded: semOpcionais ? optionalColumns : [],
    truncated: semOpcionais ? semOpcionais.truncated : false,
  };
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

// Venda é o pagamento que o webhook terminou de processar, o que liberou o
// acesso (`processed_at`). Só `status: approved` não basta: em 13/09/2026 o
// Mercado Pago avisou um "aprovado" sem valor e sem conta, logo depois de um
// cartão recusado, e o painel mostrou 1 pagamento aprovado com R$ 0,00. No
// Mercado Pago não havia venda nenhuma.
function isRecognizedApprovedPayment(payment) {
  return payment?.status === 'approved' && Boolean(payment.processed_at);
}

function summarizePayments(payments) {
  const aprovados = payments.filter(isRecognizedApprovedPayment);
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

// Recusas agrupadas pelo motivo informado pelo Mercado Pago, da mais frequente
// para a menos. `pessoas` existe porque quem tenta de novo com o mesmo cartão
// gera uma recusa por tentativa.
function summarizeDeclines(payments) {
  const porMotivo = new Map();

  payments
    .filter((payment) => payment.status === 'rejected')
    .forEach((payment) => {
      const { rotulo } = describeDeclineReason(payment.status_detail);
      const atual = porMotivo.get(rotulo) || { rotulo, total: 0, pessoas: new Set() };
      atual.total += 1;

      if (payment.user_id) {
        atual.pessoas.add(payment.user_id);
      }

      porMotivo.set(rotulo, atual);
    });

  return [...porMotivo.values()]
    .map((linha) => ({ rotulo: linha.rotulo, total: linha.total, pessoas: linha.pessoas.size }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

// Aprovados no Mercado Pago que o webhook não ligou a conta nenhuma. Se for
// dinheiro de verdade, a pessoa ficou sem o Pro e o afiliado sem comissão, e
// isso não pode depender de alguém abrir a tabela.
//
// Janela: 30 minutos para não alarmar enquanto o webhook ainda processa ou o
// Mercado Pago reenvia a notificação; 7 dias para o alerta de um caso já
// conferido sair sozinho, sem precisar apagar a linha.
const ALERTA_PAGAMENTO_DEPOIS_MS = 30 * 60 * 1000;
const ALERTA_PAGAMENTO_ATE_MS = 7 * 24 * 60 * 60 * 1000;

function findUnlinkedApprovedPayments(payments, now = new Date()) {
  const agora = now.getTime();

  return payments
    .filter((payment) => payment.status === 'approved' && !payment.processed_at)
    .filter((payment) => {
      const marca = toTime(payment.created_at);
      return marca !== null
        && agora - marca >= ALERTA_PAGAMENTO_DEPOIS_MS
        && agora - marca <= ALERTA_PAGAMENTO_ATE_MS;
    })
    .map((payment) => payment.payment_id)
    .filter(Boolean);
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

// Contas vinculadas por afiliado (profiles.referred_by_affiliate_id).
//
// É a métrica que responde "quantas pessoas esse afiliado trouxe" ANTES de
// qualquer pagamento — e a única que existe para quem chegou sem link e foi
// vinculado depois. Caso real: o TikTok do Matheus gerou 24 cadastros num dia,
// nenhum pelo link (em legenda de TikTok link não é clicável), e sem esta
// coluna o quadro dele mostrava zero em tudo.
function countLinkedAccounts(profiles) {
  const porAfiliado = new Map();

  profiles.forEach((profile) => {
    const affiliateId = profile.referred_by_affiliate_id;

    if (!affiliateId) {
      return;
    }

    porAfiliado.set(affiliateId, (porAfiliado.get(affiliateId) || 0) + 1);
  });

  return porAfiliado;
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
function summarizeAffiliates({
  affiliates,
  attributions,
  commissions,
  visitsByCode = new Map(),
  linkedByAffiliate = new Map(),
}) {
  const porAfiliado = new Map(affiliates.map((a) => [a.id, {
    codigo: a.code,
    contasVinculadas: linkedByAffiliate.get(a.id) || 0,
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
      || b.contasVinculadas - a.contasVinculadas
      || b.visitas - a.visitas
      || b.checkoutsIniciados - a.checkoutsIniciados);
}

// Repetição do mesmo evento na mesma sessão, em poucos segundos, é defeito de
// instrumentação, não uso. O evento da nota (`score_exibido`) disparava a cada
// caractere editado até 18/09/2026: 18% dos disparos vinham repetidos em menos
// de 10 s, e uma sessão sozinha gerou 40. Colapsar na leitura mantém o
// histórico intacto no banco e evita inflar "viu a nota" e o uso por evento.
const EVENTOS_COLAPSAVEIS = new Set(['score_exibido']);
const JANELA_COLAPSO_MS = 10 * 60 * 1000;

function collapseRepeatedEvents(events, { janelaMs = JANELA_COLAPSO_MS } = {}) {
  const ultimoPorChave = new Map();
  const manter = new Set();

  // Do mais antigo para o mais novo: o primeiro disparo de cada rajada fica.
  [...events]
    .map((event, indice) => ({ event, indice, marca: toTime(event.created_at) }))
    .sort((a, b) => (a.marca ?? 0) - (b.marca ?? 0))
    .forEach(({ event, indice, marca }) => {
      if (!EVENTOS_COLAPSAVEIS.has(event.event_name) || !event.session_id || marca === null) {
        manter.add(indice);
        return;
      }

      const chave = `${event.event_name}|${event.session_id}`;
      const anterior = ultimoPorChave.get(chave);

      if (anterior !== undefined && marca - anterior < janelaMs) {
        return;
      }

      ultimoPorChave.set(chave, marca);
      manter.add(indice);
    });

  return events.filter((_, indice) => manter.has(indice));
}

// --- janelas de tempo -----------------------------------------------------

// O painel e lido no Brasil, entao "hoje" tem que virar a meia-noite de
// Brasilia, nao a de UTC — senao o numero do dia zera as 21h.
//
// Subtrai o relogio de parede local do instante absoluto, em vez de assumir
// UTC-3: continua correto se o fuso mudar ou se o horario de verao voltar.
const FUSO_PAINEL = 'America/Sao_Paulo';

function startOfDayInTimeZone(now = new Date(), timeZone = FUSO_PAINEL) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(now)
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, parte.value]),
  );

  // Em alguns ICU meia-noite sai como "24" com hour12:false.
  const hora = Number(partes.hour) % 24;
  const desdeMeiaNoite = ((hora * 60 + Number(partes.minute)) * 60 + Number(partes.second)) * 1000
    + now.getMilliseconds();

  return new Date(now.getTime() - desdeMeiaNoite);
}

function buildWindows(now = new Date()) {
  return {
    hoje: startOfDayInTimeZone(now).getTime(),
    sete: now.getTime() - 7 * 24 * 60 * 60 * 1000,
    trinta: now.getTime() - 30 * 24 * 60 * 60 * 1000,
  };
}

function toTime(value) {
  if (!value) {
    return null;
  }

  const marca = new Date(value).getTime();
  return Number.isNaN(marca) ? null : marca;
}

// Conta valores distintos de `chave` em cada janela. Distinto, e nao total,
// porque a pergunta e "quantas pessoas/sessoes", nao "quantas linhas".
function countDistinctByWindow(rows, { chave, data, now = new Date() }) {
  const janelas = buildWindows(now);
  const hoje = new Set();
  const sete = new Set();
  const trinta = new Set();

  rows.forEach((row) => {
    const id = row[chave];
    const marca = toTime(row[data]);

    if (!id || marca === null) {
      return;
    }

    if (marca >= janelas.trinta) {
      trinta.add(id);
    }

    if (marca >= janelas.sete) {
      sete.add(id);
    }

    if (marca >= janelas.hoje) {
      hoje.add(id);
    }
  });

  return { hoje: hoje.size, sete: sete.size, trinta: trinta.size };
}

// Organizações por conta, pelos eventos `anamnese_gerada`.
//
// NÃO pela tabela `anamneses`: ela só ganha linha quando a pessoa pede a
// AVALIAÇÃO (generateInsights.js) — no motor atual, organizar não grava nada
// lá. Medido em 11/09/2026: 34 contas tinham organizado pelos eventos, 14
// apareciam na tabela, e o painel dizia 19% de ativação quando o piso real
// era ~47%.
//
// Credita também quem organizou ANTES de criar conta, quando foi na mesma
// sessão: a sessão anônima que organizou e depois fez login é a mesma pessoa.
// Continua sendo piso — sem consentimento de cookies não há evento.
function countOrganizationsByUser(events) {
  const usuarioDaSessao = new Map();

  events.forEach((event) => {
    if (event.user_id && event.session_id && !usuarioDaSessao.has(event.session_id)) {
      usuarioDaSessao.set(event.session_id, event.user_id);
    }
  });

  const porUsuario = new Map();

  events.forEach((event) => {
    if (event.event_name !== 'anamnese_gerada') {
      return;
    }

    const userId = event.user_id || usuarioDaSessao.get(event.session_id);

    if (!userId) {
      return;
    }

    const atual = porUsuario.get(userId) || { total: 0, ultima: null };
    atual.total += 1;

    const marca = toTime(event.created_at);

    if (marca !== null && (atual.ultima === null || marca > atual.ultima)) {
      atual.ultima = marca;
    }

    porUsuario.set(userId, atual);
  });

  return porUsuario;
}

// `contas` só conta quem ainda tem conta: evento de conta apagada ficaria no
// total e faria este número divergir da ativação (36 contra 31 em 11/09).
function summarizeOrganizations(events, profiles = null) {
  const ids = profiles ? new Set(profiles.map((profile) => profile.id)) : null;
  const usuarios = [...countOrganizationsByUser(events).keys()];

  return {
    total: events.filter((event) => event.event_name === 'anamnese_gerada').length,
    contas: ids ? usuarios.filter((id) => ids.has(id)).length : usuarios.length,
  };
}

// Rótulos do registro de uso do servidor (usage_logs).
const ROTULOS_DE_RECURSO = {
  trial_diagnostic_hypotheses: 'Hipóteses diagnósticas',
  trial_prescription_guide: 'Guia de prescrição',
  trial_clinical_drug: 'Bulário clínico',
  trial_referral_letter: 'Carta de encaminhamento',
  trial_insight: 'Avaliação da anamnese',
  trial_user_template: 'Template próprio',
  clinical_tool: 'Calculadora clínica',
};

// Uso por recurso pelo registro do servidor: não depende de cookie e vale para
// conta em teste, paga ou cortesia.
function summarizeFeatureUsage(usos = []) {
  const porRecurso = new Map();

  usos.forEach((uso) => {
    const rotulo = ROTULOS_DE_RECURSO[uso.action] || uso.action || 'Outro';
    const atual = porRecurso.get(rotulo) || { rotulo, usos: 0, contas: new Set() };
    atual.usos += 1;

    if (uso.user_id) {
      atual.contas.add(uso.user_id);
    }

    porRecurso.set(rotulo, atual);
  });

  return [...porRecurso.values()]
    .map((linha) => ({ rotulo: linha.rotulo, usos: linha.usos, contas: linha.contas.size }))
    .sort((a, b) => b.usos - a.usos || a.rotulo.localeCompare(b.rotulo));
}

// Ativação: das contas criadas, quantas chegaram a USAR o produto — organizar
// uma anamnese ou abrir um recurso (hipóteses, prescrição, bulário, calculadora,
// carta, avaliação, template próprio).
function summarizeActivation({ profiles, events = [], usos = [], now = new Date() }) {
  const janelas = buildWindows(now);
  const porUsuario = countOrganizationsByUser(events);

  // O registro do servidor entra junto com os eventos porque não depende de
  // cookie e pega quem foi direto ao bulário ou à prescrição sem organizar
  // nada. Medido em 17/09/2026: 59 contas da turma apareciam aqui contra 39
  // pelos eventos — a ativação saía subestimada em ~40%.
  usos.forEach((uso) => {
    if (!uso.user_id) {
      return;
    }

    const atual = porUsuario.get(uso.user_id) || { total: 0, ultima: null };
    atual.total += 1;

    const marca = toTime(uso.created_at);

    if (marca !== null && (atual.ultima === null || marca > atual.ultima)) {
      atual.ultima = marca;
    }

    porUsuario.set(uso.user_id, atual);
  });

  let semUso = 0;
  let usoLeve = 0;
  let usoForte = 0;
  let ativos30d = 0;
  let dormentes = 0;

  profiles.forEach((profile) => {
    const uso = porUsuario.get(profile.id);

    if (!uso || uso.total === 0) {
      semUso += 1;
      return;
    }

    if (uso.total <= 4) {
      usoLeve += 1;
    } else {
      usoForte += 1;
    }

    if (uso.ultima !== null && uso.ultima >= janelas.trinta) {
      ativos30d += 1;
    } else {
      dormentes += 1;
    }
  });

  const contas = profiles.length;

  return {
    contas,
    semUso,
    usoLeve,
    usoForte,
    ativos30d,
    dormentes,
    // A pergunta que o dono realmente faz: de cada 100 contas, quantas
    // chegaram a usar? null sem denominador, nunca 0%.
    taxaAtivacao: contas > 0
      ? Math.round(((contas - semUso) / contas) * 1000) / 10
      : null,
  };
}

// Retorno: quem voltou a usar o site, por `profiles.last_seen_at`.
//
// A coluna e nova, entao todo mundo comeca em null e enche conforme as
// pessoas voltam — por isso `semRegistro` sai junto, para o numero baixo dos
// primeiros dias nao ser lido como queda.
function summarizeReturn(profiles, now = new Date()) {
  const janelas = countDistinctByWindow(profiles, { chave: 'id', data: 'last_seen_at', now });

  return {
    ...janelas,
    semRegistro: profiles.filter((profile) => !profile.last_seen_at).length,
  };
}

// --- crescimento: comparar sem precisar decorar o número anterior ---------
//
// Duas comparações, cada uma honesta de um jeito:
// - HOJE ATÉ AGORA contra ONTEM ATÉ A MESMA HORA. Comparar o dia parcial com
//   o ontem inteiro faria toda tarde parecer queda.
// - ÚLTIMOS 7 DIAS contra os 7 ANTERIORES, em janelas corridas: dois períodos
//   do mesmo tamanho, sem dia parcial no meio.
// E uma série de 14 dias, para ver a tendência e não só a ponta.

const DIA_MS = 24 * 60 * 60 * 1000;

// Quantas linhas (ou quantos ids distintos, com `chave`) caem em [inicio, fim).
function countInRange(rows, { data, chave = null, filtro = null, inicio, fim }) {
  const vistos = new Set();
  let total = 0;

  rows.forEach((row) => {
    if (filtro && !filtro(row)) {
      return;
    }

    const marca = toTime(row[data]);

    if (marca === null || marca < inicio || marca >= fim) {
      return;
    }

    if (chave) {
      if (row[chave]) {
        vistos.add(row[chave]);
      }

      return;
    }

    total += 1;
  });

  return chave ? vistos.size : total;
}

// Sem base anterior não há porcentagem: "+5 (novo)" é verdade, "+∞%" não.
function compareChange(atual, anterior) {
  const delta = atual - anterior;

  return {
    delta,
    percentual: anterior > 0 ? Math.round((delta / anterior) * 100) : null,
    direcao: delta > 0 ? 'sobe' : delta < 0 ? 'desce' : 'igual',
  };
}

// Início de cada um dos últimos `quantidade` dias em Brasília, do mais antigo
// ao de hoje. Ancora no meio-dia de cada dia: somar 24h a partir da
// meia-noite erraria o dia na virada do horário de verão, se ele voltar.
function daysBack(now, quantidade) {
  const inicioHoje = startOfDayInTimeZone(now).getTime();
  const dias = [];

  for (let k = quantidade - 1; k >= 0; k -= 1) {
    dias.push(startOfDayInTimeZone(new Date(inicioHoje - k * DIA_MS + DIA_MS / 2)).getTime());
  }

  return dias;
}

function isVisitWithoutAccount(event) {
  return event.event_name === 'site_visita'
    && (event.metadata?.logado === false || event.metadata?.logado === 'false');
}

// O que o dono acompanha dia a dia. Ordem = ordem do funil: chega, usa,
// aprofunda, quer pagar, paga.
const METRICAS_DE_CRESCIMENTO = [
  { id: 'cadastros', rotulo: 'Cadastros', dica: 'contas criadas', fonte: 'profiles', data: 'created_at' },
  { id: 'visitas', rotulo: 'Visitas sem conta', dica: 'sessões', fonte: 'events', data: 'created_at', chave: 'session_id', filtro: isVisitWithoutAccount },
  { id: 'organizaram', rotulo: 'Sessões que organizaram', dica: 'com ou sem conta', fonte: 'events', data: 'created_at', chave: 'session_id', filtro: (event) => event.event_name === 'anamnese_gerada' },
  { id: 'contasOrganizaram', rotulo: 'Contas que organizaram', dica: 'logadas', fonte: 'events', data: 'created_at', chave: 'user_id', filtro: (event) => event.event_name === 'anamnese_gerada' && Boolean(event.user_id) },
  { id: 'hipoteses', rotulo: 'Hipóteses geradas', fonte: 'events', data: 'created_at', filtro: (event) => event.event_name === 'hipoteses_diagnosticas_geradas' },
  { id: 'cartas', rotulo: 'Cartas geradas', fonte: 'events', data: 'created_at', filtro: (event) => event.event_name === 'carta_gerada' },
  { id: 'cliquesAssinar', rotulo: 'Cliques em assinar', fonte: 'events', data: 'created_at', filtro: (event) => event.event_name === 'upgrade_click' },
  { id: 'checkouts', rotulo: 'Assinaturas iniciadas', dica: 'checkout do plano mensal', fonte: 'subscriptions', data: 'created_at' },
  { id: 'pagamentos', rotulo: 'Pagamentos aprovados', dica: 'que liberaram o acesso', fonte: 'payments', data: 'created_at', filtro: isRecognizedApprovedPayment },
];

function summarizeGrowth({ fontes, now = new Date(), metricas = METRICAS_DE_CRESCIMENTO }) {
  const agora = now.getTime();
  const fimAgora = agora + 1;
  const inicioHoje = startOfDayInTimeZone(now).getTime();
  const inicioOntem = startOfDayInTimeZone(new Date(inicioHoje - DIA_MS / 2)).getTime();
  const decorridoHoje = agora - inicioHoje;
  const dias = daysBack(now, 14);

  return metricas.map((metrica) => {
    const rows = fontes[metrica.fonte] || [];
    const conta = (inicio, fim) => countInRange(rows, { ...metrica, inicio, fim });

    const hoje = conta(inicioHoje, fimAgora);
    const ontemAteAgora = conta(inicioOntem, inicioOntem + decorridoHoje + 1);
    const ultimos7 = conta(agora - 7 * DIA_MS, fimAgora);
    const anteriores7 = conta(agora - 14 * DIA_MS, agora - 7 * DIA_MS);

    return {
      id: metrica.id,
      rotulo: metrica.rotulo,
      dica: metrica.dica || null,
      hoje,
      ontemAteAgora,
      variacaoDia: compareChange(hoje, ontemAteAgora),
      ultimos7,
      anteriores7,
      variacaoSemana: compareChange(ultimos7, anteriores7),
      serie: dias.map((inicio, indice) => ({
        dia: new Date(inicio).toISOString(),
        valor: conta(inicio, indice === dias.length - 1 ? fimAgora : dias[indice + 1]),
      })),
    };
  });
}

// --- checkout ---------------------------------------------------------------
//
// Do clique em assinar ao pagamento, nos últimos 30 dias. Clique, chegada ao
// Mercado Pago, erros e retorno vêm de eventos: dependem de cookie, e a chegada
// ao Mercado Pago começou a ser medida em 13/09/2026. Assinaturas e pagamentos
// vêm do banco e são completos. "Pessoas" existe porque a mesma pessoa clica e
// tenta mais de uma vez.

const JANELA_CHECKOUT_DIAS = 30;

const ROTULOS_ERRO_CHECKOUT = {
  rede: 'Sem conexão com o servidor',
  dados_invalidos: 'Dados inválidos para o checkout',
  sessao: 'Sessão expirada',
  limite: 'Tentativas demais',
  provedor: 'Mercado Pago não respondeu',
  configuracao: 'Checkout sem configuração no servidor',
  servidor: 'Erro no servidor',
  sem_link: 'Mercado Pago não devolveu o link',
  desconhecido: 'Outro erro',
};

// Desfecho do cartão digitado na nossa página (mensal, desde 23/09/2026). Os
// códigos vêm do servidor (services/cardCheckout.js) e do frontend
// (lib/cardCheckout.js); nunca carregam dado do cartão.
const ROTULOS_RESULTADO_CARTAO = {
  CARD_NOT_RECURRING: 'Cartão não aceita cobrança mensal (débito ou pré-pago)',
  CARD_DECLINED: 'Banco recusou o cartão',
  CARD_TOKEN_INVALID: 'Dados do cartão expiraram',
  CARD_NOT_ACCEPTED: 'Cartão não aceito, sem motivo informado',
  erro: 'Erro nosso ou do Mercado Pago',
  ja_assina: 'Já tinha assinatura ativa',
  checkout_antigo: 'Caminho desligado no servidor: foi para o Mercado Pago',
  formulario_nao_carregou: 'Formulário do cartão não carregou',
};

function motivoDoCartao(event) {
  const resultado = event.metadata?.resultado;

  if (resultado === 'recusada') {
    const motivo = event.metadata?.motivo;
    return Object.prototype.hasOwnProperty.call(ROTULOS_RESULTADO_CARTAO, motivo) ? motivo : 'CARD_NOT_ACCEPTED';
  }

  return Object.prototype.hasOwnProperty.call(ROTULOS_RESULTADO_CARTAO, resultado) ? resultado : null;
}

function percentile(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[indice];
}

function summarizeCheckout({ events = [], subscriptions = [], payments = [], now = new Date() }) {
  const fim = now.getTime();
  const inicio = fim - JANELA_CHECKOUT_DIAS * DIA_MS;
  const naJanela = (row) => {
    const marca = toTime(row.created_at);
    return marca !== null && marca >= inicio && marca <= fim;
  };
  const etapa = (id, rotulo, fonte, rows, grupo) => ({
    id,
    rotulo,
    fonte,
    grupo,
    vezes: rows.length,
    pessoas: new Set(rows.map((row) => row.user_id).filter(Boolean)).size,
  });

  const eventosNaJanela = events.filter(naJanela);
  const doEvento = (nome) => eventosNaJanela.filter((event) => event.event_name === nome);
  const redirecionados = doEvento('checkout_redirecionado');

  // Cartão na página: o mensal não passa mais pela página do Mercado Pago, então
  // "Foram ao Mercado Pago" cai sem que as vendas caiam.
  // Mensal e semestral usam os mesmos eventos; o plano separa (evento antigo,
  // sem plano, é do mensal — o semestral na página veio depois).
  const doSemestral = (event) => event.metadata?.plan_key === 'semiannual';
  const resultadosNaPagina = doEvento('checkout_cartao_resultado');
  const resultadosDoCartao = resultadosNaPagina.filter((event) => !doSemestral(event));
  const resultadosDoSemestral = resultadosNaPagina.filter(doSemestral);
  const enviosDoCartao = resultadosDoCartao.filter((event) => event.metadata?.resultado !== 'formulario_nao_carregou');
  const temposDoCartao = enviosDoCartao
    .map((event) => Number(event.metadata?.espera_ms))
    .filter((valor) => Number.isFinite(valor) && valor >= 0);
  const problemasDoCartao = new Map();
  resultadosNaPagina.forEach((event) => {
    const motivo = motivoDoCartao(event);

    if (motivo) {
      problemasDoCartao.set(motivo, (problemasDoCartao.get(motivo) || 0) + 1);
    }
  });

  const esperas = redirecionados
    .map((event) => Number(event.metadata?.espera_ms))
    .filter((valor) => Number.isFinite(valor) && valor >= 0);

  const erros = new Map();
  doEvento('checkout_erro').forEach((event) => {
    const tipo = Object.prototype.hasOwnProperty.call(ROTULOS_ERRO_CHECKOUT, event.metadata?.erro_tipo)
      ? event.metadata.erro_tipo
      : 'desconhecido';
    erros.set(tipo, (erros.get(tipo) || 0) + 1);
  });

  const retornos = { success: 0, pending: 0, failure: 0 };
  doEvento('checkout_retorno').forEach((event) => {
    const status = event.metadata?.result_status;

    if (Object.prototype.hasOwnProperty.call(retornos, status)) {
      retornos[status] += 1;
    }
  });

  return {
    janelaDias: JANELA_CHECKOUT_DIAS,
    etapas: [
      etapa('cliques', 'Clicaram em assinar', 'eventos', doEvento('upgrade_click'), 'geral'),
      etapa('cartaoAbriu', 'Abriram o formulário de cartão', 'eventos', doEvento('upgrade_click').filter((event) => event.metadata?.via === 'cartao'), 'cartao'),
      etapa('cartaoEnviou', 'Enviaram o cartão', 'eventos', enviosDoCartao, 'cartao'),
      etapa('cartaoAceito', 'Cartão aceito: assinatura criada', 'eventos', resultadosDoCartao.filter((event) => event.metadata?.resultado === 'autorizada'), 'cartao'),
      etapa('cartaoConfirmado', 'Pro liberado na mesma tela', 'eventos', doEvento('checkout_cartao_confirmado').filter((event) => !doSemestral(event)), 'cartao'),
      etapa('semestralAbriu', 'Abriram o pagamento do semestral', 'eventos', doEvento('upgrade_click').filter((event) => event.metadata?.via === 'pagina'), 'semestral_pagina'),
      etapa('semestralEnviou', 'Enviaram cartão ou pediram o Pix', 'eventos', resultadosDoSemestral.filter((event) => event.metadata?.resultado !== 'formulario_nao_carregou'), 'semestral_pagina'),
      etapa('semestralPix', 'Pix gerado (QR Code na tela)', 'eventos', resultadosDoSemestral.filter((event) => event.metadata?.resultado === 'pix'), 'semestral_pagina'),
      etapa('semestralCartao', 'Cartão aprovado ou em análise', 'eventos', resultadosDoSemestral.filter((event) => ['aprovado', 'em_analise'].includes(event.metadata?.resultado)), 'semestral_pagina'),
      etapa('semestralConfirmado', 'Pro liberado na mesma tela', 'eventos', doEvento('checkout_cartao_confirmado').filter(doSemestral), 'semestral_pagina'),
      etapa('redirecionados', 'Foram à página do Mercado Pago', 'eventos', redirecionados, 'mercado_pago'),
      etapa('assinaturas', 'Assinaturas mensais criadas', 'banco', subscriptions.filter(naJanela), 'banco'),
      etapa('recusados', 'Pagamentos recusados', 'banco', payments.filter((payment) => payment.status === 'rejected' && naJanela(payment)), 'banco'),
      etapa('aprovados', 'Pagamentos aprovados', 'banco', payments.filter((payment) => isRecognizedApprovedPayment(payment) && naJanela(payment)), 'banco'),
    ],
    espera: esperas.length
      ? { amostras: esperas.length, medianaMs: percentile(esperas, 50), p90Ms: percentile(esperas, 90) }
      : null,
    esperaCartao: temposDoCartao.length
      ? { amostras: temposDoCartao.length, medianaMs: percentile(temposDoCartao, 50), p90Ms: percentile(temposDoCartao, 90) }
      : null,
    problemasCartao: [...problemasDoCartao.entries()]
      .map(([codigo, vezes]) => ({ codigo, rotulo: ROTULOS_RESULTADO_CARTAO[codigo], vezes }))
      .sort((a, b) => b.vezes - a.vezes),
    erros: [...erros.entries()]
      .map(([tipo, vezes]) => ({ tipo, rotulo: ROTULOS_ERRO_CHECKOUT[tipo], vezes }))
      .sort((a, b) => b.vezes - a.vezes),
    retornos,
  };
}

// --- composição -----------------------------------------------------------

async function getOwnerMetrics() {
  if (!isOwnerMetricsStorageAvailable()) {
    const erro = new Error('Métricas indisponíveis: Supabase não configurado.');
    erro.statusCode = 503;
    throw erro;
  }

  const [
    profilesResult,
    paymentsResult,
    eventsResult,
    anamnesesResult,
    usageResult,
    affiliatesResult,
    attributionsResult,
    commissionsResult,
    subscriptionsResult,
    funnel,
  ] = await Promise.all([
    selectRows(
      'profiles',
      {
        select: 'id,current_plan,billing_status,plan_expires_at,trial_started_at,created_at,last_seen_at,referred_by_affiliate_id',
        // Se o Max Rows do projeto cortar, que corte as contas mais antigas —
        // as mais novas são as que pesam em ativação/retorno.
        order: 'created_at.desc',
      },
      // Enquanto profile_last_seen.sql não for aplicado à mão, esta coluna não
      // existe e derrubaria a consulta inteira.
      { optionalColumns: ['last_seen_at', 'referred_by_affiliate_id'] },
    ),
    selectRows(
      'billing_payments',
      { select: 'payment_id,status,status_detail,amount,user_id,processed_at,created_at', order: 'created_at.desc' },
      // Enquanto billing_payment_decline_reason.sql não for aplicado à mão.
      { optionalColumns: ['status_detail'] },
    ),
    // A ordem aqui é o que evita que um corte de linhas apague justo os
    // eventos de agora: sem isso já aconteceu de visita de afiliado sumir do
    // painel porque a tabela passou do teto e o Postgres devolveu as mais
    // antigas primeiro.
    selectRows('events', { select: 'user_id,session_id,event_name,metadata,created_at', order: 'created_at.desc' }),
    selectRows('anamneses', { select: 'user_id,created_at', order: 'created_at.desc' }),
    selectRows('usage_logs', { select: 'user_id,action,created_at', order: 'created_at.desc' }),
    selectRows('affiliates', { select: 'id,code,status,commission_rate' }),
    selectRows('affiliate_attributions', { select: 'affiliate_id,buyer_user_id,created_at', order: 'created_at.desc' }),
    selectRows('affiliate_commissions', { select: 'affiliate_id,gross_amount,commission_amount,status,payout_id,created_at', order: 'created_at.desc' }),
    selectRows('billing_subscriptions', { select: 'user_id,status,created_at', order: 'created_at.desc' }),
    getGlobalFunnelSessions().catch(() => ({ sessions: [], truncated: false })),
  ]);

  const profiles = profilesResult.rows;
  const payments = paymentsResult.rows;
  const events = collapseRepeatedEvents(eventsResult.rows);
  const anamneses = anamnesesResult.rows;
  const usos = usageResult.rows;
  const affiliates = affiliatesResult.rows;
  const attributions = attributionsResult.rows;
  const commissions = commissionsResult.rows;
  const subscriptions = subscriptionsResult.rows;
  const faltaLastSeen = profilesResult.degraded.includes('last_seen_at');
  const faltaMotivoRecusa = paymentsResult.degraded.includes('status_detail');
  // Nome amigável só das tabelas que o Content-Range denunciou como cortadas
  // pelo teto do servidor — não pelo `limit` que o código pede, esse a gente
  // controla.
  const tabelasTruncadas = [
    ['contas', profilesResult],
    ['pagamentos', paymentsResult],
    ['eventos', eventsResult],
    ['anamneses', anamnesesResult],
    ['registro de uso', usageResult],
    ['indicações de afiliado', attributionsResult],
    ['comissões de afiliado', commissionsResult],
    ['assinaturas', subscriptionsResult],
  ]
    .filter(([, resultado]) => resultado.truncated)
    .map(([nome]) => nome);

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

  const retorno = summarizeReturn(profiles);

  return {
    geradoEm: new Date().toISOString(),
    contas: summarizeProfiles(profiles),
    pagamentos: {
      ...summarizePayments(payments),
      semVinculo: findUnlinkedApprovedPayments(payments),
      recusasPorMotivo: summarizeDeclines(payments),
    },
    anamneses: {
      total: anamneses.length,
      usuariosDistintos: new Set(anamneses.map((a) => a.user_id).filter(Boolean)).size,
    },
    ativacao: summarizeActivation({ profiles, events, usos }),
    usoDeRecursos: summarizeFeatureUsage(usos),
    organizacoes: summarizeOrganizations(events, profiles),
    crescimento: summarizeGrowth({ fontes: { profiles, events, subscriptions, payments } }),
    checkout: summarizeCheckout({ events, subscriptions, payments }),
    retorno,
    sessoesPorPeriodo: countDistinctByWindow(events, { chave: 'session_id', data: 'created_at' }),
    retencao: summarizeRetention(events),
    eventos: summarizeEventUsage(events),
    alcance,
    funil: metricasFunil,
    afiliados: summarizeAffiliates({
      affiliates,
      attributions,
      commissions,
      visitsByCode: countAffiliateVisits(events),
      linkedByAffiliate: countLinkedAccounts(profiles),
    }),
    avisos: buildWarnings({
      tabelasTruncadas,
      funnelTruncated: funnel.truncated,
      funilDivergente,
      retornoSemRegistro: retorno.semRegistro,
      faltaLastSeen,
      faltaMotivoRecusa,
    }),
  };
}

// Ressalvas que precisam viajar junto com os números: sem elas o painel
// parece mais confiável do que é.
function buildWarnings({
  tabelasTruncadas = [],
  funnelTruncated,
  funilDivergente,
  retornoSemRegistro = 0,
  faltaLastSeen = false,
  faltaMotivoRecusa = false,
}) {
  const avisos = [
    'Quem recusa o banner de cookies não emite evento nenhum — toda métrica de evento é piso, não total.',
    'Visitas por link de afiliado começaram a ser medidas em 31/08/2026: zero antes disso é ausência de medição, não queda. Como o evento respeita o consentimento de cookies, a visita de quem recusa não é contada.',
  ];

  if (faltaLastSeen) {
    avisos.push(
      'A coluna last_seen_at ainda não existe no banco: aplique supabase/profile_last_seen.sql no SQL Editor. '
      + 'Até lá o bloco de retorno fica zerado — o resto do painel continua correto.',
    );
  } else if (retornoSemRegistro) {
    avisos.push(
      'O carimbo de retorno (last_seen_at) só passou a existir agora e enche conforme as pessoas voltam: '
      + `${retornoSemRegistro} conta(s) ainda sem registro. Número baixo aqui nos primeiros dias é ausência de medição, não queda. `
      + 'Já a ativação vem dos eventos de organização, com histórico desde que o evento existe.',
    );
  }

  if (faltaMotivoRecusa) {
    avisos.push(
      'A coluna do motivo de recusa ainda não existe no banco: aplique supabase/billing_payment_decline_reason.sql no SQL Editor. '
      + 'Até lá as recusas aparecem como "Motivo não registrado". O resto do painel continua correto.',
    );
  }

  if (funilDivergente) {
    avisos.push(
      'A ordem declarada do funil não bate com o uso real: há etapas com zero no funil estrito que aparecem no alcance. ' +
      'Use a tabela de alcance; o funil estrito só conta quem seguiu a sequência exata.',
    );
  }

  if (funnelTruncated) {
    avisos.push('O funil bateu no teto de eventos lidos e está parcial.');
  }

  if (tabelasTruncadas.length > 0) {
    avisos.push(
      `A leitura bateu no teto de linhas do banco em: ${tabelasTruncadas.join(', ')}. `
      + 'A busca já vem ordenada do mais recente para o mais antigo, então o que falta é histórico antigo, '
      + 'não atividade de agora — mas os totais e médias que dependem disso estão parciais.',
    );
  }

  return avisos;
}

module.exports = {
  getOwnerMetrics,
  isOwnerMetricsStorageAvailable,
  buildWarnings,
  buildWindows,
  countAffiliateVisits,
  countLinkedAccounts,
  countDistinctByWindow,
  collapseRepeatedEvents,
  compareChange,
  countInRange,
  countOrganizationsByUser,
  daysBack,
  fetchAllPages,
  findUnlinkedApprovedPayments,
  isRecognizedApprovedPayment,
  PAGE_SIZE,
  parseContentRange,
  summarizeActivation,
  summarizeAffiliates,
  summarizeCheckout,
  summarizeDeclines,
  summarizeEventUsage,
  summarizeFeatureUsage,
  summarizeGrowth,
  summarizeOrganizations,
  summarizePayments,
  summarizeProfiles,
  summarizeRetention,
  summarizeReturn,
  summarizeStepReach,
};
