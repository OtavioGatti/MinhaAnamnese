// Oferta do Plano Profissional: o que ele inclui (com o tamanho real do
// catálogo, vindo de /api/catalog-summary) e o que a pessoa já usou no teste
// (profile.trial_usage.used). Puro, testado em backend/tests/proOffer.test.js.

// 568 → "560+", 120 → "120", 14 → "14". Arredonda para baixo: a oferta nunca
// promete mais do que o catálogo tem.
export function formatCatalogCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  if (count < 20) {
    return String(Math.floor(count));
  }

  const floored = Math.floor(count / 10) * 10;
  const copy = floored.toLocaleString('pt-BR');

  return floored === count ? copy : `${copy}+`;
}

function withCount(count, withNumber, withoutNumber) {
  const copy = formatCatalogCount(count);
  return copy ? `${copy} ${withNumber}` : withoutNumber;
}

// Sem catálogo (rota fora do ar, ainda carregando) a lista continua concreta,
// só sem os números.
export function buildProFeatureList({ catalog = null, letterTypeCount = 0, hypothesesEnabled = true } = {}) {
  const numbers = catalog || {};
  const items = [
    {
      key: 'insights',
      title: 'Avaliação completa da anamnese',
      detail: 'Nota justificada, o ponto crítico do caso e o próximo passo clínico.',
    },
    hypothesesEnabled
      ? {
        key: 'diagnosticHypotheses',
        title: 'Hipóteses diagnósticas',
        detail: 'Geradas a partir da anamnese, com o que examinar e pedir em seguida.',
      }
      : null,
    {
      key: 'referralLetters',
      title: letterTypeCount > 1 ? `${letterTypeCount} tipos de carta e documento com IA` : 'Cartas e documentos com IA',
      detail: 'Do encaminhamento ao atestado e ao laudo, escritos a partir da anamnese.',
    },
    {
      key: 'clinicalDrugs',
      title: withCount(numbers.clinicalDrugs, 'medicamentos no bulário', 'Bulário clínico'),
      detail: 'Posologia adulta e pediátrica, ajustes, interações e cuidados.',
    },
    {
      key: 'prescriptionGuides',
      title: withCount(numbers.prescriptionGuides, 'guias de prescrição', 'Guias de prescrição'),
      detail: 'Organizados por condição clínica, prontos para adaptar ao paciente.',
    },
    {
      key: 'clinicalTools',
      title: withCount(numbers.clinicalTools, 'ferramentas clínicas', 'Ferramentas clínicas'),
      detail: 'Escores, calculadoras e checklists como vacinação e pré-natal.',
    },
    {
      key: 'examination',
      title: formatCatalogCount(numbers.maneuvers) && formatCatalogCount(numbers.exams)
        ? `${formatCatalogCount(numbers.maneuvers)} manobras e ${formatCatalogCount(numbers.exams)} exames`
        : 'Manobras de exame físico e exames',
      detail: 'Quando fazer ou pedir, como executar e como interpretar.',
    },
    {
      key: 'userTemplates',
      title: 'Templates próprios e frases prontas',
      detail: 'Do seu jeito, com a mesma avaliação dos modelos oficiais.',
    },
  ];

  return items.filter(Boolean);
}

// Ordem de exibição = do que mais pesa na decisão ao que menos pesa.
const USAGE_LABELS = [
  ['insights', 'avaliação completa', 'avaliações completas'],
  ['diagnosticHypotheses', 'análise de hipóteses', 'análises de hipóteses'],
  ['referralLetters', 'documento com IA', 'documentos com IA'],
  ['clinicalDrugs', 'medicamento no bulário', 'medicamentos no bulário'],
  ['prescriptionGuides', 'guia de prescrição', 'guias de prescrição'],
  ['clinicalTools', 'ferramenta clínica', 'ferramentas clínicas'],
  ['userTemplates', 'template próprio', 'templates próprios'],
];

export function summarizeTrialUsage(used) {
  if (!used || typeof used !== 'object') {
    return [];
  }

  return USAGE_LABELS
    .map(([key, singular, plural]) => {
      const count = Math.floor(Number(used[key]) || 0);
      return count > 0 ? { key, count, label: count === 1 ? singular : plural } : null;
    })
    .filter(Boolean);
}

// "6 avaliações completas, 2 documentos com IA e 14 medicamentos no bulário"
export function describeTrialUsage(items, max = 3) {
  const parts = (Array.isArray(items) ? items : [])
    .slice(0, max)
    .map((item) => `${item.count} ${item.label}`);

  if (parts.length <= 1) {
    return parts[0] || '';
  }

  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

// Semestral dividido por 6, já com o desconto de indicação quando houver.
export function estimatePerMonthPrice(price, months, discountRate = 0) {
  const total = Number(price);
  const divisor = Number(months);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(divisor) || divisor <= 0) {
    return null;
  }

  const rate = Number(discountRate) || 0;
  const charged = Math.round(total * (1 - rate) * 100) / 100;

  return Math.floor((charged / divisor) * 100) / 100;
}
