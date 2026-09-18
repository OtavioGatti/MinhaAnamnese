// Ação de retorno do teste: um e-mail por conta, com foco no que a turma do
// TikTok de fato usou — hipóteses diagnósticas e guia de prescrição (medido em
// 17/09/2026: 113 usos de hipóteses e 96 de prescrição, contra 17 da avaliação).
//
// Três grupos, medidos pelas DUAS fontes, porque só os eventos subcontam quem
// recusou cookies:
//   a) nenhum sinal de uso;
//   b) usou algo, mas nunca gerou hipóteses nem abriu guia de prescrição;
//   c) já usou hipóteses ou prescrição — esse recebe o convite para assinar.
//
// Nada aqui decide sozinho: a rota administrativa roda em simulação por padrão
// e só envia quando mandado. Uma conta só recebe uma vez (reengagement_sent_at).

const { buildEmailHtml } = require('./emailTemplates');
const { isEmailConfigured, sendEmail } = require('./emailNotifications');
const { BILLING_PLANS, getDiscountedPlanAmount, normalizeDiscountRate } = require('../config/billingPlans');

const FUSO = 'America/Sao_Paulo';
const INTERVALO_ENTRE_ENVIOS_MS = 650;
const PLANOS_CORTESIA = ['affiliate', 'afiliado'];
const CAMPANHA = 'retorno';

const ACAO_HIPOTESES = 'trial_diagnostic_hypotheses';
const ACAO_PRESCRICAO = 'trial_prescription_guide';

// O que citar no e-mail do grupo B como "você já usou".
const ROTULOS_DE_USO = {
  trial_clinical_drug: 'o bulário clínico',
  trial_insight: 'a avaliação da anamnese',
  trial_referral_letter: 'as cartas de encaminhamento',
  trial_user_template: 'os templates próprios',
};

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getAppUrl() {
  return process.env.PUBLIC_APP_URL || 'https://www.minhaanamnese.com.br';
}

function formatDate(value) {
  const data = new Date(value || '');
  return Number.isNaN(data.getTime()) ? null : data.toLocaleDateString('pt-BR', { timeZone: FUSO });
}

function formatMoney(value) {
  const numero = Number(value);
  return Number.isFinite(numero) ? `R$ ${numero.toFixed(2).replace('.', ',')}` : null;
}

function linkDaCampanha(grupo) {
  return `${getAppUrl()}/?utm_source=email&utm_campaign=${CAMPANHA}&utm_content=${grupo}`;
}

/**
 * Grupo da conta. `acoes` são as ações registradas no servidor (usage_logs) e
 * `organizou` vem dos eventos — juntas, cobrem quem recusou cookies.
 */
function classifyReengagementGroup({ organizou = false, acoes = [] }) {
  const usadas = new Set(acoes);

  if (usadas.has(ACAO_HIPOTESES) || usadas.has(ACAO_PRESCRICAO)) {
    return 'c';
  }

  return organizou || usadas.size > 0 ? 'b' : 'a';
}

// "o bulário clínico e as cartas de encaminhamento", ou "organizou anamnese"
// quando o único sinal veio dos eventos.
function describeUsage({ organizou = false, acoes = [] }) {
  const rotulos = [...new Set(acoes.map((acao) => ROTULOS_DE_USO[acao]).filter(Boolean))];

  if (rotulos.length === 0) {
    return organizou ? 'Você já organizou anamnese no Minha Anamnese' : 'Você começou a usar o Minha Anamnese';
  }

  const lista = rotulos.length === 1
    ? rotulos[0]
    : `${rotulos.slice(0, -1).join(', ')} e ${rotulos[rotulos.length - 1]}`;

  return `Você já usou ${lista}${organizou ? ', além de organizar anamnese,' : ''} no Minha Anamnese`;
}

function buildReengagementEmail(grupo, { expiresAt = null, amount = null, usage = {} } = {}) {
  const vence = formatDate(expiresAt);
  const quando = vence ? `<strong>${vence}</strong>` : 'nos próximos dias';
  const botao = { url: linkDaCampanha(grupo) };

  if (grupo === 'c') {
    const valor = formatMoney(amount);

    return {
      grupo,
      subject: `Seu teste termina em ${vence || 'breve'}`,
      html: buildEmailHtml({
        heading: `Seu teste termina em ${vence || 'breve'}`,
        paragraphs: [
          'Você usou as <strong>hipóteses diagnósticas</strong> ou o <strong>guia de prescrição</strong> durante o teste. São eles que saem da sua conta quando o teste terminar, junto com o bulário clínico, as cartas de encaminhamento, a avaliação completa e os templates próprios.',
          'A organização de anamneses continua gratuita, e nada do que você criou é perdido.',
          [
            valor ? `<strong>Plano mensal:</strong> ${valor}${amount < BILLING_PLANS.monthly.price ? ' (com o desconto de indicação já aplicado na sua conta)' : ''}` : null,
            '<strong>Renovação:</strong> automática, cancele quando quiser em Perfil',
          ].filter(Boolean).join('<br>'),
        ],
        button: { ...botao, label: 'Assinar o Profissional' },
        footerNote: 'Se não for a hora, sem problema: você pode assinar quando quiser.',
      }),
    };
  }

  if (grupo === 'b') {
    return {
      grupo,
      subject: 'Faltou a melhor parte do seu teste',
      html: buildEmailHtml({
        heading: 'Faltou a melhor parte',
        paragraphs: [
          `${describeUsage(usage)}, mas ainda não experimentou o recurso que o pessoal do seu grupo mais usou no teste: as <strong>hipóteses diagnósticas</strong>.`,
          'Abra uma anamnese que você já organizou e clique em <strong>hipóteses diagnósticas</strong>: saem 3 hipóteses com o raciocínio por trás, e em cada uma o <strong>guia de prescrição</strong> com as condutas, além do bulário ligado ao caso.',
          `Seu teste termina em ${quando}.`,
        ],
        button: { ...botao, label: 'Ver as hipóteses de um caso' },
        footerNote: 'Depois do teste, a organização de anamneses continua gratuita na sua conta.',
      }),
    };
  }

  return {
    grupo: 'a',
    subject: `Seu teste profissional termina em ${vence || 'breve'}`,
    html: buildEmailHtml({
      heading: 'Ainda dá tempo de testar 🩺',
      paragraphs: [
        `Seu teste do <strong>Plano Profissional</strong> no Minha Anamnese termina em ${quando}, e pelo que vimos você ainda não chegou a usar.`,
        'Leva menos de um minuto: cole o caso de um atendimento (pode ser de estudo), clique em organizar e peça as <strong>hipóteses diagnósticas</strong>. Você recebe 3 hipóteses com o raciocínio e, em cada uma, o <strong>guia de prescrição</strong> com as condutas e o bulário ligado.',
        'É justamente isso que o pessoal que entrou junto com você mais usou no teste: hipóteses, prescrição e bulário.',
      ],
      button: { ...botao, label: 'Testar com um caso agora' },
      footerNote: 'Se não fizer sentido agora, tudo bem: sua conta continua com a organização de anamneses gratuita.',
    }),
  };
}

async function getRows(path) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!response.ok) {
    const erro = new Error(`consulta falhou (${response.status})`);
    erro.status = response.status;
    throw erro;
  }

  const json = await response.json();
  return Array.isArray(json) ? json : [];
}

async function markReengagementSent(profileId, grupo) {
  const { url, serviceRoleKey } = getConfig();
  const query = new URLSearchParams({ id: `eq.${profileId}` });
  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ reengagement_sent_at: new Date().toISOString(), reengagement_group: grupo }),
  });

  return response.ok;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Seleciona, classifica e (se mandado) envia.
 *
 * `dryRun` é o padrão: devolve a contagem por grupo sem enviar nada.
 * `expiresOn` (AAAA-MM-DD, dia de Brasília) limita a onda a quem vence naquele
 * dia — foi assim que a onda 1 saiu só para quem tinha o teste acabando.
 */
async function runReengagement({
  dryRun = true,
  expiresOn = null,
  limit = 60,
  excludeEmails = [],
  now = new Date(),
} = {}) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return { pendente: 'banco_nao_configurado' };
  }

  if (!dryRun && !isEmailConfigured()) {
    return { pendente: 'email_nao_configurado' };
  }

  const excluidos = new Set(excludeEmails.map((email) => String(email).trim().toLowerCase()));
  const query = new URLSearchParams();
  query.append('select', 'id,email,plan_expires_at,access_source,current_plan,referred_by_affiliate_id,reengagement_sent_at');
  query.append('access_source', 'eq.trial');
  query.append('current_plan', `not.in.(${PLANOS_CORTESIA.join(',')})`);
  query.append('plan_expires_at', `gt.${now.toISOString()}`);
  query.append('reengagement_sent_at', 'is.null');
  query.append('order', 'plan_expires_at.asc');

  let perfis;

  try {
    perfis = await getRows(`profiles?${query.toString()}`);
  } catch (error) {
    return error.status === 400
      ? { pendente: 'aplique supabase/profile_reengagement.sql' }
      : { pendente: 'falha_ao_consultar_perfis' };
  }

  const candidatos = perfis.filter((perfil) => (
    perfil.email
    && !excluidos.has(String(perfil.email).toLowerCase())
    && (!expiresOn || formatDate(perfil.plan_expires_at) === formatDate(`${expiresOn}T12:00:00-03:00`))
  ));

  if (candidatos.length === 0) {
    return { candidatos: 0, porGrupo: {}, enviados: 0, dryRun, resultados: [] };
  }

  const ids = candidatos.map((perfil) => perfil.id).join(',');
  const [logs, organizacoes, afiliados] = await Promise.all([
    getRows(`usage_logs?user_id=in.(${ids})&select=user_id,action`),
    getRows(`events?user_id=in.(${ids})&event_name=eq.anamnese_gerada&select=user_id`),
    getRows('affiliates?select=id,discount_rate'),
  ]);

  const acoesPorUsuario = new Map();
  logs.forEach((linha) => {
    const lista = acoesPorUsuario.get(linha.user_id) || [];
    lista.push(linha.action);
    acoesPorUsuario.set(linha.user_id, lista);
  });
  const organizou = new Set(organizacoes.map((linha) => linha.user_id));
  const descontoPorAfiliado = new Map(afiliados.map((a) => [a.id, normalizeDiscountRate(a.discount_rate)]));

  const porGrupo = { a: 0, b: 0, c: 0 };
  const resultados = [];

  for (const perfil of candidatos.slice(0, limit)) {
    const usage = { organizou: organizou.has(perfil.id), acoes: acoesPorUsuario.get(perfil.id) || [] };
    const grupo = classifyReengagementGroup(usage);
    porGrupo[grupo] += 1;

    if (dryRun) {
      resultados.push({ profileId: perfil.id, grupo, enviado: false });
      continue;
    }

    const desconto = descontoPorAfiliado.get(perfil.referred_by_affiliate_id) || 0;
    const email = buildReengagementEmail(grupo, {
      expiresAt: perfil.plan_expires_at,
      amount: getDiscountedPlanAmount(BILLING_PLANS.monthly, desconto),
      usage,
    });

    if (resultados.length > 0) {
      await pause(INTERVALO_ENTRE_ENVIOS_MS);
    }

    const envio = await sendEmail({ to: perfil.email, subject: email.subject, html: email.html });

    if (envio.ok) {
      await markReengagementSent(perfil.id, grupo).catch(() => null);
    }

    // Sem e-mail no resumo: a resposta pode parar em log de agendador.
    resultados.push({ profileId: perfil.id, grupo, enviado: envio.ok, erro: envio.ok ? undefined : String(envio.error || '').slice(0, 160) });
  }

  return {
    dryRun,
    candidatos: candidatos.length,
    considerados: Math.min(candidatos.length, limit),
    porGrupo,
    enviados: resultados.filter((r) => r.enviado).length,
    falhas: resultados.filter((r) => !r.enviado && !dryRun).length,
    resultados,
  };
}

module.exports = {
  buildReengagementEmail,
  classifyReengagementGroup,
  describeUsage,
  runReengagement,
};
