const ABSENT_PATTERNS = [
  /\bnao informado\b/g,
  /\bnão informado\b/g,
  /\bnao refere\b/g,
  /\bnão refere\b/g,
];

const CATEGORY_CONFIG = [
  {
    id: 'history',
    label: 'história clínica',
    weight: 9,
    patterns: ['historia', 'queixa', 'qp', 'evolucao', 'hda', 'sintomas associados'],
  },
  {
    id: 'exam',
    label: 'exame físico',
    weight: 10,
    patterns: ['exame fisico', 'ao exame', 'sinais vitais', 'ectoscopia', 'exame'],
  },
  {
    id: 'background',
    label: 'antecedentes',
    weight: 8,
    patterns: ['antecedentes', 'comorbidades', 'historia pregressa', 'antecedente'],
  },
  {
    id: 'medications',
    label: 'medicações e alergias',
    weight: 8,
    patterns: ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia'],
  },
  {
    id: 'plan',
    label: 'conduta e hipótese',
    weight: 7,
    patterns: ['conduta', 'hipotese', 'impressao diagnostica', 'avaliacao'],
  },
];

const SPECIALTY_OVERRIDES = {
  pediatria: {
    background: ['desenvolvimento', 'neuropsicomotor', 'vacinacao'],
    history: ['aceitacao alimentar', 'eliminacoes'],
  },
  obstetricia: {
    history: ['ig', 'dum', 'usg'],
    exam: ['bcf', 'movimentacao fetal', 'contrações', 'contracoes'],
  },
  ginecologia: {
    history: ['historia menstrual', 'sexual', 'contracepcao', 'contraceptivo'],
  },
  upa_emergencia: {
    exam: ['saturacao', 'pressao', 'frequencia cardiaca', 'frequencia respiratoria'],
    plan: ['gravidade', 'sinais de gravidade'],
  },
};

const HIGH_MESSAGES = [
  'Boa base clínica, mas há lacunas importantes que podem impactar a avaliação do caso.',
  'Boa base clínica, mas alguns pontos ainda podem limitar a avaliação do caso.',
];

const MEDIUM_MESSAGES = [
  'Há lacunas relevantes que limitam a avaliação clínica.',
  'A anamnese apresenta lacunas relevantes que ainda limitam a avaliação clínica.',
];

const LOW_MESSAGES = [
  'Anamnese insuficiente para uma avaliação clínica segura.',
  'O registro ainda está insuficiente para uma avaliação clínica segura.',
];

const JUSTIFICATION_VARIANTS = {
  exam: [
    'A descrição do exame físico ainda pode ser mais detalhada.',
    'Faltam achados objetivos do exame físico para sustentar melhor a avaliação.',
  ],
  medications: [
    'Ainda faltam informações sobre medicações em uso ou alergias.',
    'Medicações em uso e alergias ainda não aparecem com clareza suficiente.',
  ],
  background: [
    'Os antecedentes ainda podem ser descritos com mais clareza.',
    'Há pouca exploração de antecedentes relevantes para o caso.',
  ],
  demographic: [
    'Idade ou sexo ainda não aparecem de forma clara no registro.',
    'A identificação clínica básica ainda pode ser mais objetiva.',
  ],
  structure: [
    'A estrutura do registro ainda pode ficar mais segmentada.',
    'A organização do texto ainda pode ser mais clara entre os blocos clínicos.',
  ],
  coverage: [
    'Há espaço para ampliar a cobertura de itens clínicos importantes.',
    'Alguns eixos clínicos importantes ainda aparecem pouco explorados.',
  ],
};

const CRITICAL_INSIGHT_MESSAGES = {
  exam: 'Ausência de exame físico pode comprometer a hipótese diagnóstica.',
  medications: 'Falta de medicações em uso pode impactar a conduta.',
  background: 'Antecedentes não descritos limitam a avaliação do caso.',
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsAny(text, values) {
  return values.some((value) => text.includes(value));
}

function pickVariant(collection, seed) {
  return collection[seed % collection.length];
}

function lineHasAbsentMarker(line) {
  const normalizedLine = normalizeText(line);
  return ABSENT_PATTERNS.some((pattern) => pattern.test(normalizedLine));
}

function fieldMarkedAbsent(text, fieldPatterns) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some((line) => {
    const normalizedLine = normalizeText(line);
    return fieldPatterns.some((pattern) => normalizedLine.includes(pattern)) && lineHasAbsentMarker(line);
  });
}

function detectCategory(text, category, templateId) {
  const categoryPatterns = [...category.patterns];
  const specialtyPatterns = SPECIALTY_OVERRIDES[templateId]?.[category.id] || [];
  return containsAny(text, [...categoryPatterns, ...specialtyPatterns]);
}

function buildMainMessage(score, seed) {
  if (score >= 80) return pickVariant(HIGH_MESSAGES, seed);
  if (score >= 50) return pickVariant(MEDIUM_MESSAGES, seed);
  return pickVariant(LOW_MESSAGES, seed);
}

function buildJustification(missingFields, structureSegmented, matchedCategories, seed) {
  if (missingFields.exam) return pickVariant(JUSTIFICATION_VARIANTS.exam, seed);
  if (missingFields.medications) return pickVariant(JUSTIFICATION_VARIANTS.medications, seed);
  if (missingFields.background) return pickVariant(JUSTIFICATION_VARIANTS.background, seed);
  if (missingFields.demographic) return pickVariant(JUSTIFICATION_VARIANTS.demographic, seed);
  if (!structureSegmented) return pickVariant(JUSTIFICATION_VARIANTS.structure, seed);
  if (matchedCategories.length <= 2) return pickVariant(JUSTIFICATION_VARIANTS.coverage, seed);

  return 'Alguns pontos ainda podem ser descritos com mais objetividade clínica.';
}

function buildCriticalInsight(missingFields) {
  if (missingFields.exam) return CRITICAL_INSIGHT_MESSAGES.exam;
  if (missingFields.medications) return CRITICAL_INSIGHT_MESSAGES.medications;
  if (missingFields.background) return CRITICAL_INSIGHT_MESSAGES.background;
  return '';
}

export function evaluateAnamnesisQuality(text, templateId = '') {
  const rawText = (text || '').trim();
  const normalizedText = normalizeText(rawText);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const characterCount = rawText.length;

  if (characterCount < 180 || wordCount < 30) {
    return {
      shouldShowScore: false,
      score: null,
      message: 'Ainda não há conteúdo suficiente para estimar a avaliação inicial da anamnese.',
      justification: 'Inclua um registro um pouco mais detalhado para liberar a estimativa.',
      criticalInsight: '',
      teaser: {
        shouldShowTeaser: false,
        message: '',
      },
    };
  }

  const paragraphCount = rawText
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean).length;
  const sentenceCount = rawText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
  const hasSectionLabels = /(^|\n)\s*[a-zà-ú0-9/\- ]{2,30}\s*:/gim.test(rawText);
  const structureSegmented = paragraphCount >= 2 || hasSectionLabels;

  const hasAge = /\b\d{1,3}\s*anos?\b/.test(normalizedText);
  const hasSex = containsAny(normalizedText, [
    'masculino',
    'feminino',
    'sexo masc',
    'sexo fem',
    'sexo masculino',
    'sexo feminino',
  ]);
  const demographicMissing = !(hasAge || hasSex);

  const backgroundMissing =
    fieldMarkedAbsent(rawText, ['antecedentes', 'comorbidades', 'historia pregressa']) ||
    !detectCategory(normalizedText, CATEGORY_CONFIG.find((category) => category.id === 'background'), templateId);

  const medicationsMissing =
    fieldMarkedAbsent(rawText, ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia']) ||
    !detectCategory(normalizedText, CATEGORY_CONFIG.find((category) => category.id === 'medications'), templateId);

  const examMissing =
    fieldMarkedAbsent(rawText, ['exame', 'exame fisico', 'sinais vitais', 'ao exame']) ||
    !detectCategory(normalizedText, CATEGORY_CONFIG.find((category) => category.id === 'exam'), templateId);

  const missingFields = {
    demographic: demographicMissing,
    background: backgroundMissing,
    medications: medicationsMissing,
    exam: examMissing,
  };

  const matchedCategories = CATEGORY_CONFIG.filter((category) =>
    detectCategory(normalizedText, category, templateId)
  );

  let sizePoints = 0;
  if (wordCount >= 45) sizePoints += 4;
  if (wordCount >= 90) sizePoints += 4;
  if (characterCount >= 500) sizePoints += 4;
  sizePoints = Math.min(sizePoints, 12);

  let structurePoints = 0;
  if (paragraphCount >= 2) structurePoints += 4;
  if (paragraphCount >= 4) structurePoints += 2;
  if (sentenceCount >= 4) structurePoints += 2;
  if (hasSectionLabels) structurePoints += 2;
  structurePoints = Math.min(structurePoints, 10);

  const categoryPoints = matchedCategories.reduce((total, category) => total + category.weight, 0);

  let score = 30 + sizePoints + structurePoints + categoryPoints;

  if (missingFields.exam) score -= 20;
  if (missingFields.medications) score -= 15;
  if (missingFields.background) score -= 10;

  const criticalMissingCount = Object.values(missingFields).filter(Boolean).length;
  let maxScore = 90;

  if (criticalMissingCount >= 2) {
    maxScore = 70;
  } else if (criticalMissingCount >= 1) {
    maxScore = 80;
  }

  score = clamp(Math.round(Math.min(score, maxScore)), 30, 90);

  const seed =
    wordCount +
    characterCount +
    paragraphCount +
    sentenceCount +
    matchedCategories.length +
    criticalMissingCount;

  const criticalInsight = buildCriticalInsight(missingFields);

  return {
    shouldShowScore: true,
    score,
    message: buildMainMessage(score, seed),
    justification: buildJustification(missingFields, structureSegmented, matchedCategories, seed),
    criticalInsight,
    teaser: {
      shouldShowTeaser: Boolean(criticalInsight),
      message: criticalInsight,
    },
  };
}
