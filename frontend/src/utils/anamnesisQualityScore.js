const KEYWORD_WEIGHTS = [
  { pattern: /\bhist[oó]ria\b/gi, weight: 9, label: 'história clínica' },
  { pattern: /\bexame\b/gi, weight: 8, label: 'exame físico' },
  { pattern: /\bantecedentes?\b/gi, weight: 8, label: 'antecedentes' },
  { pattern: /\bmedica[cç][aã]o(?:es)?\b/gi, weight: 7, label: 'medicações' },
  { pattern: /\balergia(?:s)?\b/gi, weight: 6, label: 'alergias' },
  { pattern: /\bconduta\b/gi, weight: 6, label: 'conduta' },
  { pattern: /\bqueixa\b/gi, weight: 5, label: 'queixa principal' },
  { pattern: /\bhip[oó]tese\b/gi, weight: 5, label: 'hipótese clínica' },
  { pattern: /\bsinais vitais\b/gi, weight: 5, label: 'sinais vitais' },
];

const LOW_SCORE_MESSAGES = [
  'Há lacunas relevantes na coleta de informações.',
  'A anamnese ainda pede complementação em pontos essenciais.',
  'O registro inicial aponta necessidade de maior aprofundamento clínico.',
];

const MEDIUM_SCORE_MESSAGES = [
  'A estrutura está adequada, com pontos a aprofundar.',
  'O registro está consistente, com espaço para maior completude clínica.',
  'A base está organizada, com oportunidades de detalhamento adicional.',
];

const HIGH_SCORE_MESSAGES = [
  'Boa organização, com oportunidades de refinamento.',
  'A anamnese está bem construída, com margem para pequenos ajustes.',
  'O registro demonstra boa consistência, com refinamentos pontuais possíveis.',
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickVariant(score, matchedKeywordsCount, structurePoints) {
  if (score < 55) {
    return LOW_SCORE_MESSAGES[(matchedKeywordsCount + structurePoints) % LOW_SCORE_MESSAGES.length];
  }

  if (score < 75) {
    return MEDIUM_SCORE_MESSAGES[(matchedKeywordsCount + structurePoints) % MEDIUM_SCORE_MESSAGES.length];
  }

  return HIGH_SCORE_MESSAGES[(matchedKeywordsCount + structurePoints) % HIGH_SCORE_MESSAGES.length];
}

export function evaluateAnamnesisQuality(text) {
  const normalizedText = (text || '').trim();
  const characterCount = normalizedText.length;
  const words = normalizedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const wordCount = words.length;

  if (characterCount < 180 || wordCount < 30) {
    return {
      shouldShowScore: false,
      message: 'Ainda não há conteúdo suficiente para estimar a qualidade da anamnese.',
      justification: 'Inclua um registro um pouco mais detalhado para liberar a estimativa.',
      score: null,
    };
  }

  let keywordPoints = 0;
  const matchedKeywordLabels = [];

  KEYWORD_WEIGHTS.forEach(({ pattern, weight, label }) => {
    if (pattern.test(normalizedText)) {
      keywordPoints += weight;
      matchedKeywordLabels.push(label);
    }
  });

  const paragraphCount = normalizedText
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean).length;
  const hasSectionLabels = /(^|\n)\s*[a-zà-ú]{2,20}\s*:/gim.test(normalizedText);
  const sentenceCount = normalizedText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;

  let sizePoints = 0;
  if (wordCount >= 45) sizePoints += 6;
  if (wordCount >= 90) sizePoints += 6;
  if (characterCount >= 450) sizePoints += 4;
  if (characterCount >= 900) sizePoints += 4;
  sizePoints = Math.min(sizePoints, 16);

  let structurePoints = 0;
  if (paragraphCount >= 2) structurePoints += 4;
  if (paragraphCount >= 4) structurePoints += 4;
  if (sentenceCount >= 4) structurePoints += 3;
  if (hasSectionLabels) structurePoints += 5;
  structurePoints = Math.min(structurePoints, 12);

  const score = clamp(Math.round(34 + sizePoints + keywordPoints + structurePoints), 30, 90);

  const topKeywords = matchedKeywordLabels.slice(0, 3);
  const justificationParts = [];

  if (topKeywords.length > 0) {
    justificationParts.push(`Foram identificados elementos como ${topKeywords.join(', ')}.`);
  }

  if (paragraphCount >= 2 || hasSectionLabels) {
    justificationParts.push('O texto apresenta alguma organização estrutural.');
  } else {
    justificationParts.push('A organização do conteúdo ainda pode ficar mais clara.');
  }

  if (wordCount < 60) {
    justificationParts.push('O nível de detalhamento ainda está enxuto.');
  } else if (wordCount > 140) {
    justificationParts.push('O detalhamento contribui positivamente para a completude do registro.');
  } else {
    justificationParts.push('O volume de informações está em uma faixa intermediária.');
  }

  return {
    shouldShowScore: true,
    score,
    message: pickVariant(score, matchedKeywordLabels.length, structurePoints),
    justification: justificationParts.join(' '),
  };
}
