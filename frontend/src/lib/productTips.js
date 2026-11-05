// Dicas contextuais do produto: balões ancorados no botão/área de cada função,
// um de cada vez, no momento em que a função fica relevante. Nunca um tour na
// entrada: metade de quem viu o modal de boas-vindas nem chegou a organizar.
//
// Cada dica aparece uma vez por conta (profiles.tips_seen) e quem já usou a
// função (profile.trial_usage.used) não recebe a dica dela. Este módulo é puro
// (sem React, sem DOM) e é testado em backend/tests/productTips.test.js.

// Liga as dicas só neste navegador, para testar em produção antes de abrir
// para todo mundo: ?dicas=1 liga (e ignora as já vistas), ?dicas=0 desliga.
export const PRODUCT_TIPS_OVERRIDE_KEY = 'minha-anamnese:dicas';
const PARAMETRO_DE_TESTE = 'dicas';

export function resolveProductTipsEnabled({ flag, search = '', stored = null }) {
  const parametro = new URLSearchParams(search).get(PARAMETRO_DE_TESTE);
  let guardado = stored === '1' ? '1' : null;

  if (parametro === '1') {
    guardado = '1';
  } else if (parametro === '0') {
    guardado = null;
  }

  // preview: modo de teste deste navegador — mostra as dicas de novo mesmo
  // que o perfil já as tenha como vistas (o "Entendi" vale só até recarregar).
  return { enabled: flag === 'on' || guardado === '1', preview: guardado === '1', stored: guardado };
}

// Ordem = prioridade. `when` recebe o contexto da tela (ver useProductTips);
// `usedFeature` é a chave de profile.trial_usage.used que, quando > 0, dispensa
// a dica; `target` é o valor de data-tip no elemento ancorado.
export const PRODUCT_TIPS = [
  {
    id: 'frases_prontas',
    title: 'Frases prontas',
    text: 'Não comece do zero: insira trechos prontos de exame físico, antecedentes e negativas com um clique, ou salve os seus.',
    usedFeature: null,
    when: (c) => c.page === 'home' && c.textoVazio && !c.resultado,
  },
  {
    id: 'arroba',
    title: 'Mencione o remédio com @',
    text: 'Digite @ e o nome do remédio: o bulário aparece aqui mesmo, com interações entre os medicamentos da anamnese e risco na gestação.',
    usedFeature: null,
    when: (c) => c.page === 'home' && c.drugMentionsEnabled && c.textoLength >= 200 && !c.textoTemArroba,
  },
  {
    id: 'hipoteses',
    title: 'Hipóteses diagnósticas',
    text: 'Veja o que não pode passar: hipóteses a partir do que você escreveu, com evidências, o que falta coletar e sinais de alerta.',
    usedFeature: 'diagnosticHypotheses',
    when: (c) => c.page === 'home' && c.resultado && c.hypothesesCount === 0,
  },
  {
    id: 'analise',
    title: 'Análise da anamnese',
    text: 'Quer saber o que enfraquece esta anamnese? A análise aponta a lacuna principal e o próximo passo para completá-la.',
    usedFeature: 'insights',
    when: (c) => c.page === 'home' && c.resultado && c.canRunAnalysis,
  },
  {
    id: 'hipotese_detalhe',
    title: 'Dentro de cada hipótese',
    text: 'Abra a hipótese para ver o exame físico que confirma ou afasta, os exames complementares e a prescrição guiada do quadro.',
    usedFeature: null,
    when: (c) => c.page === 'home' && c.hypothesesCount > 0,
  },
  {
    id: 'escore_sugerido',
    title: 'Escore sugerido para este modelo',
    text: 'Este modelo tem escores validados para o quadro: calcule aqui com os dados da anamnese e leve o resultado para o prontuário.',
    usedFeature: 'clinicalTools',
    when: (c) => c.page === 'home' && c.resultado && c.linkedToolsCount > 0,
  },
  {
    id: 'prescricoes',
    title: 'Prescrição guiada',
    text: 'Protocolos de prescrição por quadro clínico, com dose, via e ajustes, para consultar antes de prescrever.',
    usedFeature: 'prescriptionGuides',
    when: (c) => c.page === 'home' && c.hypothesesCount > 0,
  },
  {
    id: 'cartas',
    title: 'Cartas e documentos',
    text: 'Encaminhamento, atestado e laudo saem prontos a partir da anamnese, com busca de CID-10 e o termo de ciência quando precisa.',
    usedFeature: 'referralLetters',
    when: (c) => c.page === 'home' && c.resultado && c.anamnesesCount >= 3,
  },
  {
    id: 'meus_modelos',
    title: 'Seu modelo de anamnese',
    text: 'Já tem uma estrutura própria? Monte seu modelo uma vez e organize sempre nela, com a mesma qualidade dos oficiais.',
    usedFeature: 'userTemplates',
    when: (c) => c.page === 'home' && c.anamnesesCount >= 2,
  },
  {
    id: 'calculadoras',
    title: 'Calculadoras no editor',
    text: 'Glasgow, CURB-65, IMC e outros escores sem sair do texto: calcule aqui e o resultado entra na anamnese.',
    usedFeature: null,
    when: (c) => c.page === 'home' && c.templateTemCalculadora && (c.textoLength >= 300 || c.anamnesesCount >= 3),
  },
  {
    id: 'ferramentas',
    title: 'Ferramentas clínicas',
    text: 'Escores, checklists de vacinação, marcos do desenvolvimento e pré-natal, todos aqui, sem precisar lembrar os critérios.',
    usedFeature: 'clinicalTools',
    when: (c) => c.page === 'home' && c.anamnesesCount >= 2,
  },
];

export const PRODUCT_TIP_IDS = PRODUCT_TIPS.map((tip) => tip.id);

function featureUsed(usedFeatures, feature) {
  if (!feature || !usedFeatures || typeof usedFeatures !== 'object') {
    return false;
  }

  return Number(usedFeatures[feature] || 0) > 0;
}

/**
 * Escolhe a próxima dica a mostrar, ou null.
 *
 * @param {object} args
 * @param {string[]} args.seen ids já fechados (perfil + esta sessão)
 * @param {object} args.context contexto da tela
 * @param {object} [args.usedFeatures] profile.trial_usage.used
 * @param {(id: string) => boolean} [args.isTargetPresent] o elemento ancorado existe?
 * @param {Array} [args.tips] lista (padrão PRODUCT_TIPS)
 */
export function pickNextTip({ seen = [], context = {}, usedFeatures = null, isTargetPresent = () => true, tips = PRODUCT_TIPS }) {
  const seenSet = new Set(Array.isArray(seen) ? seen : []);

  for (const tip of tips) {
    if (seenSet.has(tip.id) || featureUsed(usedFeatures, tip.usedFeature)) {
      continue;
    }

    let aplicavel = false;

    try {
      aplicavel = Boolean(tip.when(context));
    } catch (_error) {
      aplicavel = false;
    }

    if (aplicavel && isTargetPresent(tip.id)) {
      return tip;
    }
  }

  return null;
}

// Quantas menções "@remedio" há no texto (para medir o uso do @).
const MENTION_COUNT_REGEX = /(^|[\s([{:;,])@[a-z0-9]{2,}/gi;

export function countDrugMentions(text) {
  const matches = String(text || '').match(MENTION_COUNT_REGEX);
  return matches ? matches.length : 0;
}
