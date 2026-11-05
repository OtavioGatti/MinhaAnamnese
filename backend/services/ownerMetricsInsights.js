// Leituras do painel do dono que respondem às perguntas da semana: o site
// cresceu, quem está em teste vira pagante, que função cada conta adotou, as
// dicas contextuais estão sendo lidas e a IA está lenta.
//
// Só funções puras sobre as linhas que ownerMetrics.js já busca (perfis,
// eventos, registro de uso, pagamentos). Nada aqui lê o banco nem escreve.
// Agregados, nunca pessoas: nenhum e-mail, nome ou texto clínico entra.

const DIA_MS = 24 * 60 * 60 * 1000;
const FUSO_PAINEL = 'America/Sao_Paulo';

function toTime(value) {
  const marca = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(marca) ? marca : null;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function pct(parte, total) {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}

function compareChange(atual, anterior) {
  const delta = atual - anterior;

  return {
    delta,
    percentual: anterior > 0 ? Math.round((delta / anterior) * 100) : null,
    direcao: delta > 0 ? 'sobe' : delta < 0 ? 'desce' : 'igual',
  };
}

function isRecognizedApprovedPayment(payment) {
  return payment?.status === 'approved' && Boolean(payment.processed_at);
}

function inRange(marca, inicio, fim) {
  return marca !== null && marca >= inicio && marca < fim;
}

// --- resumo da semana ---------------------------------------------------------
//
// Seis números dos últimos 7 dias contra os 7 anteriores. Sem "hoje": às 13h
// o dia parcial é quase sempre zero com seta vermelha, e isso só assusta.
function summarizeWeek({ profiles = [], events = [], payments = [], now = new Date() } = {}) {
  const agora = now.getTime();
  const fim = agora + 1;
  const inicio7 = agora - 7 * DIA_MS;
  const inicio14 = agora - 14 * DIA_MS;

  const contar = (rows, { data = 'created_at', chave = null, filtro = null, soma = null }) => (inicio, fimJanela) => {
    const vistos = new Set();
    let total = 0;

    rows.forEach((row) => {
      if (filtro && !filtro(row)) {
        return;
      }

      if (!inRange(toTime(row[data]), inicio, fimJanela)) {
        return;
      }

      if (chave) {
        if (row[chave]) {
          vistos.add(row[chave]);
        }
        return;
      }

      total += soma ? (Number(row[soma]) || 0) : 1;
    });

    return chave ? vistos.size : (soma ? roundMoney(total) : total);
  };

  const metricas = [
    { id: 'cadastros', rotulo: 'Cadastros', conta: contar(profiles, {}) },
    {
      id: 'contasOrganizaram',
      rotulo: 'Contas que organizaram',
      conta: contar(events, { chave: 'user_id', filtro: (e) => e.event_name === 'anamnese_gerada' && Boolean(e.user_id) }),
    },
    { id: 'anamneses', rotulo: 'Anamneses organizadas', conta: contar(events, { filtro: (e) => e.event_name === 'anamnese_gerada' }) },
    { id: 'hipoteses', rotulo: 'Hipóteses geradas', conta: contar(events, { filtro: (e) => e.event_name === 'hipoteses_diagnosticas_geradas' }) },
    { id: 'pagamentos', rotulo: 'Pagamentos aprovados', conta: contar(payments, { filtro: isRecognizedApprovedPayment }) },
    { id: 'receita', rotulo: 'Receita', dinheiro: true, conta: contar(payments, { filtro: isRecognizedApprovedPayment, soma: 'amount' }) },
  ];

  return metricas.map((m) => {
    const atual = m.conta(inicio7, fim);
    const anterior = m.conta(inicio14, inicio7);

    return {
      id: m.id,
      rotulo: m.rotulo,
      dinheiro: Boolean(m.dinheiro),
      atual,
      anterior,
      variacao: compareChange(atual, anterior),
    };
  });
}

// --- funil do teste Pro, por mês de cadastro ----------------------------------
//
// A pergunta: de quem entrou em cada mês, quantos chegaram a usar, quantos
// usaram recurso Pro, quantos ainda estão no teste, quantos deixaram o teste
// acabar sem pagar e quantos pagaram.
function monthKeyInTimeZone(value, timeZone = FUSO_PAINEL) {
  const marca = toTime(value);

  if (marca === null) {
    return null;
  }

  // en-CA dá "YYYY-MM-DD"; os 7 primeiros são o mês.
  return new Date(marca).toLocaleDateString('en-CA', { timeZone }).slice(0, 7);
}

function collectPayers({ profiles = [], payments = [] } = {}) {
  const pagaram = new Set();

  payments.forEach((payment) => {
    if (isRecognizedApprovedPayment(payment) && payment.user_id) {
      pagaram.add(payment.user_id);
    }
  });

  profiles.forEach((profile) => {
    if (profile.access_source === 'paid' && String(profile.current_plan || '').toLowerCase() === 'pro') {
      pagaram.add(profile.id);
    }
  });

  return pagaram;
}

function isTrialActive(profile, agora) {
  const expira = toTime(profile.plan_expires_at);

  return profile.access_source === 'trial'
    && String(profile.current_plan || '').toLowerCase() === 'pro'
    && (expira === null || expira > agora);
}

function summarizeTrialCohorts({ profiles = [], events = [], usos = [], payments = [], now = new Date(), meses = 6 } = {}) {
  const agora = now.getTime();
  const pagaram = collectPayers({ profiles, payments });
  const usaram = new Set();
  const usaramPro = new Set();

  events.forEach((event) => {
    if (event.event_name === 'anamnese_gerada' && event.user_id) {
      usaram.add(event.user_id);
    }
  });

  usos.forEach((uso) => {
    if (!uso.user_id) {
      return;
    }

    usaram.add(uso.user_id);

    if (String(uso.action || '').startsWith('trial_')) {
      usaramPro.add(uso.user_id);
    }
  });

  const porMes = new Map();

  profiles.forEach((profile) => {
    const mes = monthKeyInTimeZone(profile.created_at);

    if (!mes) {
      return;
    }

    const linha = porMes.get(mes) || {
      mes,
      entraram: 0,
      usaram: 0,
      usaramPro: 0,
      emTeste: 0,
      expiraramSemPagar: 0,
      pagaram: 0,
    };

    linha.entraram += 1;

    if (usaram.has(profile.id)) {
      linha.usaram += 1;
    }

    if (usaramPro.has(profile.id)) {
      linha.usaramPro += 1;
    }

    if (pagaram.has(profile.id)) {
      linha.pagaram += 1;
    } else if (isTrialActive(profile, agora)) {
      linha.emTeste += 1;
    } else if (profile.trial_started_at) {
      linha.expiraramSemPagar += 1;
    }

    porMes.set(mes, linha);
  });

  return [...porMes.values()]
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, meses)
    .map((linha) => ({
      ...linha,
      taxaUso: pct(linha.usaram, linha.entraram),
      taxaPagamento: pct(linha.pagaram, linha.entraram),
    }));
}

// --- adoção por função ---------------------------------------------------------
//
// Quantas contas já usaram cada função, em % das contas que usaram alguma
// coisa, e quantas nos últimos 7 dias. Mistura o registro do servidor (não
// depende de cookie) com os eventos que só existem no navegador (frases
// prontas, @ do bulário), marcando a fonte.
const FUNCOES = [
  { id: 'organizar', rotulo: 'Organizar anamnese', eventos: ['anamnese_gerada'], acoes: [] },
  { id: 'hipoteses', rotulo: 'Hipóteses diagnósticas', eventos: [], acoes: ['trial_diagnostic_hypotheses'] },
  { id: 'prescricao', rotulo: 'Guia de prescrição', eventos: [], acoes: ['trial_prescription_guide'] },
  { id: 'bulario', rotulo: 'Bulário clínico', eventos: [], acoes: ['trial_clinical_drug'] },
  { id: 'arroba', rotulo: 'Menção @ no texto', eventos: ['interacao_arroba_usada'], acoes: [] },
  { id: 'frases', rotulo: 'Frases prontas', eventos: ['frase_pronta_usada'], acoes: [] },
  { id: 'ferramentas', rotulo: 'Ferramentas clínicas', eventos: ['ferramenta_calculada'], acoes: ['clinical_tool'] },
  { id: 'cartas', rotulo: 'Cartas e documentos', eventos: [], acoes: ['trial_referral_letter'] },
  { id: 'analise', rotulo: 'Análise da anamnese', eventos: [], acoes: ['trial_insight'] },
  { id: 'modelos', rotulo: 'Modelos próprios', eventos: [], acoes: ['trial_user_template'] },
];

function summarizeAdoption({ events = [], usos = [], now = new Date() } = {}) {
  const inicio7 = now.getTime() - 7 * DIA_MS;
  const porFuncao = new Map(FUNCOES.map((f) => [f.id, { contas: new Set(), contas7d: new Set() }]));
  const ativas = new Set();

  const registra = (lista, acha) => {
    lista.forEach((row) => {
      if (!row.user_id) {
        return;
      }

      const funcao = acha(row);

      if (!funcao) {
        return;
      }

      ativas.add(row.user_id);
      const bucket = porFuncao.get(funcao.id);
      bucket.contas.add(row.user_id);

      if (toTime(row.created_at) >= inicio7) {
        bucket.contas7d.add(row.user_id);
      }
    });
  };

  registra(events, (e) => FUNCOES.find((f) => f.eventos.includes(e.event_name)));
  registra(usos, (u) => FUNCOES.find((f) => f.acoes.includes(u.action)));

  return {
    contasAtivas: ativas.size,
    funcoes: FUNCOES.map((f) => {
      const bucket = porFuncao.get(f.id);

      return {
        id: f.id,
        rotulo: f.rotulo,
        fonte: f.acoes.length ? 'servidor' : 'eventos',
        contas: bucket.contas.size,
        pctDasAtivas: pct(bucket.contas.size, ativas.size),
        contas7d: bucket.contas7d.size,
      };
    }).sort((a, b) => b.contas - a.contas || a.rotulo.localeCompare(b.rotulo)),
  };
}

// Modelos clínicos mais usados no organizar (metadata.template do evento), nos
// últimos 30 dias.
function summarizeTopTemplates(events = [], { now = new Date(), dias = 30, limite = 8 } = {}) {
  const inicio = now.getTime() - dias * DIA_MS;
  const porTemplate = new Map();
  let total = 0;

  events.forEach((event) => {
    if (event.event_name !== 'anamnese_gerada' || toTime(event.created_at) < inicio) {
      return;
    }

    const template = String(event.metadata?.template || '').trim() || '(sem modelo)';
    porTemplate.set(template, (porTemplate.get(template) || 0) + 1);
    total += 1;
  });

  return {
    total,
    dias,
    templates: [...porTemplate.entries()]
      .map(([template, vezes]) => ({ template, vezes, pct: pct(vezes, total) }))
      .sort((a, b) => b.vezes - a.vezes || a.template.localeCompare(b.template))
      .slice(0, limite),
  };
}

// --- dicas contextuais -------------------------------------------------------
//
// Por dica: exibida, fechada com "Entendi" e quantas pessoas usaram a função
// nos 7 dias depois de fechar. Os ids são os de frontend/src/lib/productTips.js
// (um teste confere que as duas listas batem).
const DICAS = [
  { id: 'frases_prontas', rotulo: 'Frases prontas', eventos: ['frase_pronta_usada'], acoes: [] },
  { id: 'arroba', rotulo: 'Mencione o remédio com @', eventos: ['interacao_arroba_usada'], acoes: [] },
  { id: 'hipoteses', rotulo: 'Hipóteses diagnósticas', eventos: ['hipoteses_diagnosticas_geradas'], acoes: ['trial_diagnostic_hypotheses'] },
  { id: 'analise', rotulo: 'Análise da anamnese', eventos: ['insight_gerado'], acoes: ['trial_insight'] },
  { id: 'hipotese_detalhe', rotulo: 'Dentro de cada hipótese', eventos: ['hipoteses_raciocinio_completo_click', 'hipotese_manobra_click', 'hipotese_exame_click', 'hipotese_prescricao_click'], acoes: [] },
  { id: 'escore_sugerido', rotulo: 'Escore sugerido para o modelo', eventos: ['ferramenta_vinculada_click', 'ferramenta_calculada'], acoes: ['clinical_tool'] },
  { id: 'prescricoes', rotulo: 'Prescrição guiada', eventos: ['hipotese_prescricao_click'], acoes: ['trial_prescription_guide'] },
  { id: 'cartas', rotulo: 'Cartas e documentos', eventos: ['carta_gerada'], acoes: ['trial_referral_letter'] },
  { id: 'meus_modelos', rotulo: 'Seu modelo de anamnese', eventos: [], acoes: ['trial_user_template'] },
  { id: 'calculadoras', rotulo: 'Calculadoras no editor', eventos: ['ferramenta_calculada'], acoes: ['clinical_tool'] },
  { id: 'ferramentas', rotulo: 'Ferramentas clínicas', eventos: ['ferramenta_calculada'], acoes: ['clinical_tool'] },
];

const JANELA_DEPOIS_DA_DICA_MS = 7 * DIA_MS;

function summarizeTips({ events = [], usos = [] } = {}) {
  const porDica = new Map(DICAS.map((d) => [d.id, {
    exibidas: 0,
    concluidas: 0,
    pessoasExibidas: new Set(),
    // user_id -> primeira vez que fechou a dica
    concluiuEm: new Map(),
  }]));

  events.forEach((event) => {
    if (event.event_name !== 'dica_exibida' && event.event_name !== 'dica_concluida') {
      return;
    }

    const bucket = porDica.get(String(event.metadata?.dica || ''));

    if (!bucket) {
      return;
    }

    if (event.event_name === 'dica_exibida') {
      bucket.exibidas += 1;

      if (event.user_id) {
        bucket.pessoasExibidas.add(event.user_id);
      }

      return;
    }

    bucket.concluidas += 1;

    const marca = toTime(event.created_at);

    if (event.user_id && marca !== null) {
      const anterior = bucket.concluiuEm.get(event.user_id);

      if (anterior === undefined || marca < anterior) {
        bucket.concluiuEm.set(event.user_id, marca);
      }
    }
  });

  // Uso da função por pessoa, para checar se veio depois da dica.
  const usoPorPessoa = new Map();
  const registraUso = (userId, chave, marca) => {
    if (!userId || marca === null) {
      return;
    }

    const lista = usoPorPessoa.get(userId) || [];
    lista.push({ chave, marca });
    usoPorPessoa.set(userId, lista);
  };

  events.forEach((e) => registraUso(e.user_id, `evento:${e.event_name}`, toTime(e.created_at)));
  usos.forEach((u) => registraUso(u.user_id, `acao:${u.action}`, toTime(u.created_at)));

  return DICAS.map((dica) => {
    const bucket = porDica.get(dica.id);
    const sinais = new Set([
      ...dica.eventos.map((nome) => `evento:${nome}`),
      ...dica.acoes.map((nome) => `acao:${nome}`),
    ]);
    let usaramDepois = 0;

    bucket.concluiuEm.forEach((marcaDica, userId) => {
      const usou = (usoPorPessoa.get(userId) || []).some(({ chave, marca }) => (
        sinais.has(chave) && marca >= marcaDica && marca <= marcaDica + JANELA_DEPOIS_DA_DICA_MS
      ));

      if (usou) {
        usaramDepois += 1;
      }
    });

    const pessoasConcluidas = bucket.concluiuEm.size;

    return {
      id: dica.id,
      rotulo: dica.rotulo,
      exibidas: bucket.exibidas,
      pessoasExibidas: bucket.pessoasExibidas.size,
      concluidas: bucket.concluidas,
      pessoasConcluidas,
      usaramDepois,
      taxaUsoDepois: pct(usaramDepois, pessoasConcluidas),
    };
  });
}

// --- latência da IA -----------------------------------------------------------
//
// Só as hipóteses gravam durationMs no registro de uso (o organizar não passa
// pelo usage_logs). Mediana e p90 dos últimos 7 e 30 dias.
function percentile(valores, p) {
  if (!valores.length) {
    return null;
  }

  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1));
  return Math.round(ordenados[indice]);
}

function summarizeAiLatency(usos = [], { now = new Date() } = {}) {
  const agora = now.getTime();
  const duracoes = usos
    .filter((uso) => uso.action === 'trial_diagnostic_hypotheses')
    .map((uso) => ({ marca: toTime(uso.created_at), ms: Number(uso.metadata?.durationMs) }))
    .filter(({ marca, ms }) => marca !== null && Number.isFinite(ms) && ms > 0);

  const janela = (dias) => {
    const inicio = agora - dias * DIA_MS;
    const valores = duracoes.filter(({ marca }) => marca >= inicio).map(({ ms }) => ms);

    return {
      amostras: valores.length,
      p50Ms: percentile(valores, 0.5),
      p90Ms: percentile(valores, 0.9),
      acimaDe20s: valores.filter((ms) => ms > 20000).length,
    };
  };

  return {
    hipoteses: {
      ultimos7: janela(7),
      ultimos30: janela(30),
    },
  };
}

module.exports = {
  DICAS,
  FUNCOES,
  collectPayers,
  monthKeyInTimeZone,
  summarizeAdoption,
  summarizeAiLatency,
  summarizeTips,
  summarizeTopTemplates,
  summarizeTrialCohorts,
  summarizeWeek,
};
