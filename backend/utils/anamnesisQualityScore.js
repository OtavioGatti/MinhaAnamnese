const CATEGORY_CONFIG = [
  {
    id: 'history',
    weight: 7,
    patterns: ['historia', 'queixa', 'qp', 'evolucao', 'hda', 'sintomas associados', 'dor', 'febre'],
  },
  {
    id: 'exam',
    weight: 7,
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
    weight: 5,
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
const TIME_PATTERNS = ['hora', 'horas', 'dia', 'dias', 'semana', 'semanas', 'mes', 'meses', 'inicio', 'desde', 'ontem', 'hoje'];
const EVOLUTION_PATTERNS = ['evolucao', 'progressiva', 'progressivo', 'piora', 'piora progressiva', 'melhora', 'agravamento', 'intermitente', 'continua'];
const OBJECTIVE_DESCRIPTION_PATTERNS = ['intensa', 'leve', 'moderada', 'forte', 'irradiacao', 'localizada', 'em aperto', 'pressao', 'pontada', 'queimacao', 'sudorese', 'dispneia', 'vomitos'];
const SEVERITY_PATTERNS = ['dor toracica', 'sincope', 'perda de consciencia', 'idoso', 'idosa'];

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

function hasAbsentMarker(value) {
  const normalizedValue = normalizeText(value).trim();
  return ABSENT_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
}

function isCampoPreenchido(valor) {
  if (!valor) return false;

  const texto = normalizeText(valor).trim();
  return !(texto === '' || hasAbsentMarker(texto));
}

function getLabeledFieldValue(text, fieldPatterns) {
  const normalizedText = text.replace(/\r/g, '');
  const labeledMatches = normalizedText.matchAll(/(^|[\n.])\s*([^:\n.]{2,40}):\s*([^\n.]*)/g);

  for (const match of labeledMatches) {
    const label = normalizeText(match[2]);

    if (fieldPatterns.some((pattern) => label.includes(pattern))) {
      return match[3] || '';
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
  const segments = text
    .split(/[\n.]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return segments.some((line) => {
    const normalizedLine = normalizeText(line);
    return fieldPatterns.some((pattern) => normalizedLine.includes(pattern)) && hasAbsentMarker(normalizedLine);
  });
}

function detectCategory(text, category, templateId) {
  const specialtyPatterns = SPECIALTY_OVERRIDES[templateId]?.[category.id] || [];
  return containsAny(text, [...category.patterns, ...specialtyPatterns]);
}

function detectHistoriaVaga(text) {
  const normalizedText = normalizeText(text);
  const hasTime = containsAny(normalizedText, TIME_PATTERNS) || /\b\d+\s*(h|hs|min|dias?|semanas?|meses?|anos?)\b/.test(normalizedText);
  const hasEvolution = containsAny(normalizedText, EVOLUTION_PATTERNS);
  const hasObjectiveDescription = containsAny(normalizedText, OBJECTIVE_DESCRIPTION_PATTERNS);

  return !(hasTime && hasEvolution && hasObjectiveDescription);
}

function detectGravidadeSemExame(normalizedText, temExameFisico) {
  return !temExameFisico && containsAny(normalizedText, SEVERITY_PATTERNS);
}

function evaluateAnamnesisQuality(text, templateId = '') {
  const rawText = (text || '').trim();
  const normalizedText = normalizeText(rawText);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const characterCount = rawText.length;

  if (!rawText || characterCount < 20 || wordCount < 4) {
    return {
      shouldShowScore: false,
      score: null,
      teaser: {
        shouldShowTeaser: false,
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
  const hasSectionLabels = /(^|\n)\s*[a-z0-9/\- ]{2,30}\s*:/gim.test(normalizedText);

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

  let scoreBase = 42;
  if (wordCount >= 25) scoreBase += 8;
  if (wordCount >= 50) scoreBase += 8;
  if (wordCount >= 80) scoreBase += 7;
  if (characterCount >= 250) scoreBase += 4;
  if (characterCount >= 500) scoreBase += 4;
  if (hasAge || hasSex) scoreBase += 5;
  if (detectCategory(normalizedText, historyCategory, templateId)) scoreBase += 8;

  let scoreEstrutura = 0;
  if (paragraphCount >= 2) scoreEstrutura += 6;
  if (sentenceCount >= 3) scoreEstrutura += 6;
  if (hasSectionLabels) scoreEstrutura += 8;
  scoreEstrutura = Math.min(scoreEstrutura, 20);

  const scoreCobertura = matchedCategories.reduce((total, category) => total + category.weight, 0);
  const historiaVaga = detectHistoriaVaga(rawText);

  let score = scoreBase + scoreEstrutura + scoreCobertura;

  if (!temExameFisico) score -= 25;
  if (!temMedicacoes) score -= 15;
  if (!temAntecedentes) score -= 10;

  const missingCritical = [!temExameFisico, !temMedicacoes, !temAntecedentes].filter(Boolean).length;
  if (missingCritical >= 2) score -= 20;
  if (missingCritical === 3) score -= 30;
  if (historiaVaga) score -= 15;

  const gravidadeSemExame = detectGravidadeSemExame(normalizedText, temExameFisico);
  if (gravidadeSemExame) score -= 20;

  score = clamp(Math.round(score), 30, 90);

  const hasTeaser = !temExameFisico || !temMedicacoes || !temAntecedentes || historiaVaga || gravidadeSemExame;

  return {
    shouldShowScore: true,
    score,
    teaser: {
      shouldShowTeaser: hasTeaser,
    },
  };
}

module.exports = {
  evaluateAnamnesisQuality,
};
