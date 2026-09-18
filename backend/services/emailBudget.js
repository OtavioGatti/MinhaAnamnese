// Orçamento diário de e-mails das rotinas automáticas.
//
// O plano gratuito do Resend entrega 100 e-mails por dia, e a MESMA cota
// provavelmente atende os e-mails de confirmação de cadastro (SMTP do
// Supabase). Estourar o teto é o pior resultado possível: gente nova deixa de
// conseguir criar conta. Em 18/09/2026 o dia projetava 92 de 100.
//
// Por isso as rotinas param antes de um teto menor, deixando folga para o
// cadastro e para os e-mails de pagamento, que não podem esperar. Quem fica de
// fora NÃO é marcado como notificado: entra na rodada do dia seguinte.

const FUSO = 'America/Sao_Paulo';
const DEFAULT_BUDGET = 60;

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getDailyEmailBudget() {
  const parsed = Number.parseInt(process.env.EMAIL_DAILY_BUDGET, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_BUDGET;
}

// Início do dia em Brasília. O provedor zera a cota em UTC, então contar a
// partir daqui é conservador nas últimas horas da noite — e conservador é o
// lado certo de errar.
function startOfDayInTimeZone(now = new Date(), timeZone = FUSO) {
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

  const hora = Number(partes.hour) % 24;
  const desdeMeiaNoite = ((hora * 60 + Number(partes.minute)) * 60 + Number(partes.second)) * 1000
    + now.getMilliseconds();

  return new Date(now.getTime() - desdeMeiaNoite);
}

// Conta pelas MARCAS no banco, não por um contador próprio: é o mesmo dado que
// impede o reenvio, então nunca sai de sincronia com o que foi realmente enviado.
const MARCAS = [
  ['profiles', 'trial_reminder_2d_sent_at'],
  ['profiles', 'trial_reminder_expired_sent_at'],
  ['profiles', 'reengagement_sent_at'],
  ['billing_payments', 'notified_at'],
];

async function contarDesde(tabela, coluna, desdeIso) {
  const { url, serviceRoleKey } = getConfig();
  const query = new URLSearchParams({ select: 'id', [coluna]: `gte.${desdeIso}`, limit: '1' });
  const response = await fetch(`${url}/rest/v1/${tabela}?${query.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    throw new Error(`contagem falhou (${tabela}.${coluna}: ${response.status})`);
  }

  const total = Number(String(response.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

async function countEmailsSentToday(now = new Date()) {
  const { url, serviceRoleKey } = getConfig();

  if (!url || !serviceRoleKey) {
    return null;
  }

  const desde = startOfDayInTimeZone(now).toISOString();

  try {
    const totais = await Promise.all(MARCAS.map(([tabela, coluna]) => contarDesde(tabela, coluna, desde)));
    return totais.reduce((soma, total) => soma + total, 0);
  } catch (error) {
    console.warn('email: não foi possível contar os envios do dia', JSON.stringify({ erro: String(error?.message || '').slice(0, 160) }));
    return null;
  }
}

/**
 * Quantos e-mails as rotinas automáticas ainda podem mandar hoje.
 *
 * Sem conseguir contar, devolve 0: melhor a pessoa receber amanhã do que o
 * cadastro de alguém novo quebrar hoje.
 */
async function getRemainingDailyBudget(now = new Date()) {
  const enviados = await countEmailsSentToday(now);

  if (enviados === null) {
    return { orcamento: getDailyEmailBudget(), enviados: null, restante: 0 };
  }

  const orcamento = getDailyEmailBudget();
  return { orcamento, enviados, restante: Math.max(0, orcamento - enviados) };
}

// Quem já recebeu outro e-mail nosso hoje espera a próxima rodada: duas
// mensagens diferentes no mesmo dia cansam e consomem a cota em dobro.
// Aconteceu com 13 pessoas em 18/09/2026 (ação de retorno de manhã e "seu teste
// terminou" à tarde).
function recebeuEmailHoje(profile, now = new Date()) {
  const inicio = startOfDayInTimeZone(now).getTime();

  return [profile?.reengagement_sent_at, profile?.trial_reminder_2d_sent_at]
    .filter(Boolean)
    .some((marca) => {
      const tempo = new Date(marca).getTime();
      return Number.isFinite(tempo) && tempo >= inicio;
    });
}

module.exports = {
  countEmailsSentToday,
  DEFAULT_BUDGET,
  getDailyEmailBudget,
  getRemainingDailyBudget,
  recebeuEmailHoje,
  startOfDayInTimeZone,
};
