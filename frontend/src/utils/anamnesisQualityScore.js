const CATEGORY_CONFIG = [
  {
    id: 'history',
    weight: 6,
    patterns: ['historia', 'queixa', 'qp', 'evolucao', 'hda', 'sintomas associados', 'dor', 'febre'],
  },
  {
    id: 'exam',
    weight: 6,
    patterns: ['exame fisico', 'ao exame', 'sinais vitais', 'ectoscopia', 'ausculta', 'palpacao', 'pressao arterial'],
  },
  {
    id: 'background',
    weight: 6,
    patterns: ['antecedentes', 'comorbidades', 'historia pregressa', 'doencas previas', 'cirurgias previas'],
  },
  {
    id: 'medications',
    weight: 6,
    patterns: ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia', 'uso continuo'],
  },
  {
    id: 'plan',
    weight: 6,
    patterns: ['conduta', 'hipotese', 'impressao diagnostica', 'avaliacao', 'plano'],
  },
];

const SPECIALTY_OVERRIDES = {
  pediatria: {
    history: ['aceitacao alimentar', 'eliminacoes', 'vacinacao'],
  },
  obstetricia: {
    history: ['ig', 'dum', 'usg', 'movimentacao fetal', 'contracoes'],
    exam: ['bcf', 'batimentos cardiofetais', 'altura uterina'],
  },
  ginecologia: {
    history: ['historia menstrual', 'historia sexual', 'corrimento', 'dor pelvica'],
  },
  upa_emergencia: {
    exam: ['saturacao', 'frequencia cardiaca', 'frequencia respiratoria', 'glasgow'],
    plan: ['sinais de gravidade', 'risco'],
  },
};

const ABSENT_PATTERNS = ['nao informado', 'nao descrito', 'nao realizado', 'ignorado'];

const HIGH_MESSAGES = [
  'Boa base clínica, com registro globalmente coerente para avaliação inicial.',
  'A anamnese tem boa consistência clínica para sustentar a avaliação inicial.',
];

const MEDIUM_MESSAGES = [
  'Há lacunas clínicas relevantes que reduzem a confiabilidade da avaliação.',
  'A anamnese sustenta parte da avaliação, mas ainda tem lacunas clínicas importantes.',
];

const LOW_MESSAGES = [
  'Anamnese insuficiente para uma avaliação clínica segura.',
  'O registro ainda está frágil para sustentar uma avaliação clínica confiável.',
];

const CRITICAL_INSIGHT_MESSAGES = {
  exam: 'Ausência de exame físico compromete a avaliação de um quadro potencialmente grave.',
  medications: 'Ausência de medicações em uso pode ocultar interações, efeitos adversos e impacto na conduta.',
  background: 'Ausência de antecedentes limita a avaliação de riscos e muda a interpretação do quadro clínico.',
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

function hasAbsentMarker(value) {
  const normalizedValue = normalizeText(value).trim();
  return ABSENT_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
}

export function isCampoPreenchido(valor) {
  if (!valor) return false;

  const texto = normalizeText(valor).trim();

  if (texto === '' || hasAbsentMarker(texto)) {
    return false;
  }

  return true;
}

function getLabeledFieldValue(text, fieldPatterns) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const labeledMatch = line.match(/^([^:]+):\s*(.*)$/);

    if (!labeledMatch) {
      continue;
    }

    const label = normalizeText(labeledMatch[1]);

    if (fieldPatterns.some((pattern) => label.includes(pattern))) {
      return labeledMatch[2] || '';
    }
  }

  return null;
}

function hasFilledField(text, directPatterns, evidencePatterns = []) {
  const labeledValue = getLabeledFieldValue(text, directPatterns);

  if (labeledValue !== null) {
    return isCampoPreenchido(labeledValue);
  }

  const normalizedText = normalizeText(text);
  return containsAny(normalizedText, [...directPatterns, ...evidencePatterns]);
}

function fieldMarkedAbsent(text, fieldPatterns) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some((line) => {
    const normalizedLine = normalizeText(line);
    return fieldPatterns.some((pattern) => normalizedLine.includes(pattern)) && hasAbsentMarker(normalizedLine);
  });
}

function detectCategory(text, category, templateId) {
  const specialtyPatterns = SPECIALTY_OVERRIDES[templateId]?.[category.id] || [];
  return containsAny(text, [...category.patterns, ...specialtyPatterns]);
}

function buildMainMessage(score, seed) {
  if (score >= 80) return pickVariant(HIGH_MESSAGES, seed);
  if (score >= 55) return pickVariant(MEDIUM_MESSAGES, seed);
  return pickVariant(LOW_MESSAGES, seed);
}

function buildJustification({ missingFields, poorCoverage, wordCount }) {
  if (missingFields.exam) {
    return 'Sem exame físico descrito, a estimativa clínica perde segurança e não deve ser supervalorizada.';
  }

  if (missingFields.medications) {
    return 'Faltam medicações em uso ou alergias, o que reduz a segurança da interpretação clínica.';
  }

  if (missingFields.background) {
    return 'Antecedentes ausentes limitam a leitura de risco e contexto do caso.';
  }

  if (poorCoverage) {
    return 'O registro ainda cobre poucos eixos clínicos essenciais para uma avaliação mais confiável.';
  }

  if (wordCount < 35) {
    return 'O texto ainda está curto para sustentar uma avaliação clínica mais sólida.';
  }

  return 'A base clínica está razoável, mas ainda pode ganhar precisão com mais objetividade e completude.';
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

  if (!rawText || characterCount < 20 || wordCount < 4) {
    return {
      shouldShowScore: false,
      score: null,
      message: 'Ainda não há conteúdo suficiente para estimar a qualidade da anamnese.',
      justification: 'Inclua um registro clínico inicial para liberar a avaliação.',
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

  const historyCategory = CATEGORY_CONFIG.find((category) => category.id === 'history');
  const examCategory = CATEGORY_CONFIG.find((category) => category.id === 'exam');
  const backgroundCategory = CATEGORY_CONFIG.find((category) => category.id === 'background');
  const medicationsCategory = CATEGORY_CONFIG.find((category) => category.id === 'medications');

  const exameFisico = getLabeledFieldValue(rawText, ['exame fisico', 'exame', 'ao exame', 'sinais vitais']);
  const medicacoes = getLabeledFieldValue(rawText, ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia']);
  const antecedentes = getLabeledFieldValue(rawText, ['antecedentes', 'comorbidades', 'historia pregressa']);

  const temExameFisico =
    !fieldMarkedAbsent(rawText, ['exame fisico', 'exame', 'ao exame', 'sinais vitais']) &&
    (isCampoPreenchido(exameFisico) ||
      hasFilledField(rawText, ['exame fisico', 'ao exame', 'sinais vitais'], examCategory?.patterns || []));
  const temMedicacoes =
    !fieldMarkedAbsent(rawText, ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia']) &&
    (isCampoPreenchido(medicacoes) ||
      hasFilledField(rawText, ['medicacoes', 'medicacao', 'medicamentos', 'alergias', 'alergia'], medicationsCategory?.patterns || []));
  const temAntecedentes =
    !fieldMarkedAbsent(rawText, ['antecedentes', 'comorbidades', 'historia pregressa']) &&
    (isCampoPreenchido(antecedentes) ||
      hasFilledField(rawText, ['antecedentes', 'comorbidades', 'historia pregressa'], backgroundCategory?.patterns || []));

  const matchedCategories = CATEGORY_CONFIG.filter((category) => detectCategory(normalizedText, category, templateId));
  const hasAge = /\b\d{1,3}\s*anos?\b/.test(normalizedText);
  const hasSex = containsAny(normalizedText, [
    'masculino',
    'feminino',
    'sexo masc',
    'sexo fem',
    'sexo masculino',
    'sexo feminino',
  ]);

  let scoreBase = 40;

  if (wordCount >= 25) scoreBase += 8;
  if (wordCount >= 50) scoreBase += 8;
  if (wordCount >= 80) scoreBase += 6;
  if (characterCount >= 250) scoreBase += 4;
  if (hasAge || hasSex) scoreBase += 5;
  if (detectCategory(normalizedText, historyCategory, templateId)) scoreBase += 8;

  let scoreEstrutura = 0;
  if (paragraphCount >= 2) scoreEstrutura += 8;
  if (sentenceCount >= 3) scoreEstrutura += 6;
  if (hasSectionLabels) scoreEstrutura += 10;
  scoreEstrutura = Math.min(scoreEstrutura, 30);

  const scoreCobertura = matchedCategories.reduce((total, category) => total + category.weight, 0);

  let score = scoreBase + scoreEstrutura + scoreCobertura;

  if (!temExameFisico) score -= 25;
  if (!temMedicacoes) score -= 15;
  if (!temAntecedentes) score -= 10;

  const missingCritical = [!temExameFisico, !temMedicacoes, !temAntecedentes].filter(Boolean).length;

  if (missingCritical >= 1) {
    score = Math.min(score, 80);
  }

  if (missingCritical >= 2) {
    score = Math.min(score, 70);
  }

  if (!temExameFisico) {
    score = Math.min(score, 75);
  }

  if (!temExameFisico && missingCritical >= 2) {
    score = Math.min(score, 65);
  }

  const poorCoverage = matchedCategories.length <= 2;
  const incompleteCase = (wordCount < 25 || characterCount < 140) || (wordCount < 35 && poorCoverage);

  if (incompleteCase) {
    score = Math.min(score, 55);
  }

  score = clamp(Math.round(score), 30, 90);

  const missingFields = {
    exam: !temExameFisico,
    medications: !temMedicacoes,
    background: !temAntecedentes,
  };

  const seed =
    wordCount +
    characterCount +
    paragraphCount +
    sentenceCount +
    matchedCategories.length +
    missingCritical;

  const criticalInsight = buildCriticalInsight(missingFields);

  return {
    shouldShowScore: true,
    score,
    message: buildMainMessage(score, seed),
    justification: buildJustification({ missingFields, poorCoverage, wordCount }),
    criticalInsight,
    teaser: {
      shouldShowTeaser: Boolean(criticalInsight),
      message: criticalInsight,
    },
  };
}
