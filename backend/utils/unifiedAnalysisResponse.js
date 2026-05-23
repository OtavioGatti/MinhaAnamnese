const { sanitizeText } = require('./textSanitization');

const ALLOWED_SECTION_STATUSES = new Set(['present', 'partial', 'missing', 'not_applicable']);
const EMERGENCY_RISK_PATTERNS = [
  /dor\s+tor[aá]cica/i,
  /precordialgia/i,
  /dispneia/i,
  /s[ií]ncope/i,
  /sangramento/i,
  /hemorragia/i,
  /rebaixamento/i,
  /d[eé]ficit\s+neurol[oó]gico/i,
  /instabilidade/i,
  /sudorese/i,
  /dor\s+opressiva/i,
];
const OBJECTIVE_EXAM_PATTERNS = [
  /\bpa\b/i,
  /press[aã]o\s+arterial/i,
  /\bfc\b/i,
  /frequ[eê]ncia\s+card[ií]aca/i,
  /\bfr\b/i,
  /frequ[eê]ncia\s+respirat[oó]ria/i,
  /temperatura/i,
  /satura[cç][aã]o/i,
  /\bspo2\b/i,
  /exame\s+f[ií]sico/i,
  /ao\s+exame/i,
];

function normalizeText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeScore(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeArray(value, maxItems = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const items = [];

  for (const item of value) {
    const text = normalizeText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(text);

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

function extractJsonObject(rawText) {
  const text = sanitizeText(String(rawText || '')).trim();

  if (!text) {
    throw new Error('empty_unified_analysis_response');
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start < 0 || end <= start) {
      throw new Error('invalid_unified_analysis_json');
    }

    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeConfidence(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized === 'alta' || normalized === 'high') {
    return 'alta';
  }

  if (normalized === 'media' || normalized === 'medium') {
    return 'media';
  }

  if (normalized === 'baixa' || normalized === 'low') {
    return 'baixa';
  }

  return 'baixa';
}

function normalizeSectionStatus(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized === 'presente' || normalized === 'complete') {
    return 'present';
  }

  if (normalized === 'parcial' || normalized === 'incomplete') {
    return 'partial';
  }

  if (normalized === 'ausente' || normalized === 'not_reported') {
    return 'missing';
  }

  if (normalized === 'nao_aplicavel' || normalized === 'not_applicable') {
    return 'not_applicable';
  }

  return ALLOWED_SECTION_STATUSES.has(normalized) ? normalized : 'partial';
}

function buildCriticalInsightFromObject(priorityInsight) {
  if (!priorityInsight || typeof priorityInsight !== 'object') {
    return '';
  }

  const failure = normalizeText(priorityInsight.failure || priorityInsight.falha);
  const readingImpact = normalizeText(
    priorityInsight.readingImpact ||
    priorityInsight.reading_impact ||
    priorityInsight.consequence ||
    priorityInsight.consequencia,
  );
  const qualityImpact = normalizeText(
    priorityInsight.qualityImpact ||
    priorityInsight.quality_impact ||
    priorityInsight.impact ||
    priorityInsight.impacto,
  );
  const action = normalizeText(priorityInsight.action || priorityInsight.acao || priorityInsight.recommendation);

  if (!failure && !readingImpact && !qualityImpact && !action) {
    return '';
  }

  return [
    `FALHA -> ${failure || 'Lacuna estrutural prioritária'}`,
    `CONSEQUENCIA NA LEITURA -> ${readingImpact || 'Reduz a clareza da leitura do caso'}`,
    `IMPACTO NA QUALIDADE -> ${qualityImpact || 'Diminui a consistência documental da anamnese'}`,
    `ACAO DIRETA -> ${action || 'Complete esse ponto na próxima coleta'}`,
  ].join(' -> ');
}

function normalizeSections(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 40).map((section, index) => {
    const maxScore = normalizeScore(section?.maxScore ?? section?.max_score ?? section?.weight);
    const score = normalizeScore(section?.score);

    return {
      id: normalizeText(section?.id) || `section_${index + 1}`,
      label: normalizeText(section?.label || section?.name || section?.title) || `Seção ${index + 1}`,
      status: normalizeSectionStatus(section?.status),
      score: score === null ? null : score,
      maxScore: maxScore === null ? null : maxScore,
      evidence: normalizeText(section?.evidence),
      issue: normalizeText(section?.issue || section?.gap),
      recommendation: normalizeText(section?.recommendation || section?.action),
    };
  });
}

function getScoreLabel(score) {
  if (score <= 30) {
    return 'Estrutura crítica';
  }

  if (score <= 50) {
    return 'Estrutura insuficiente';
  }

  if (score <= 70) {
    return 'Estrutura parcial';
  }

  if (score <= 85) {
    return 'Boa estrutura com lacunas relevantes';
  }

  return 'Estrutura consistente';
}

function getSectionStatusCounts(sections) {
  return sections.reduce((counts, section) => {
    const status = section.status || 'partial';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {
    present: 0,
    partial: 0,
    missing: 0,
    not_applicable: 0,
  });
}

function sectionLooksLike(section, patterns) {
  const haystack = normalizeForSearch([
    section?.id,
    section?.label,
    section?.issue,
    section?.recommendation,
  ].filter(Boolean).join(' '));

  return patterns.some((pattern) => pattern.test(haystack));
}

function findObjectiveExamSection(sections) {
  return sections.find((section) => sectionLooksLike(section, [
    /exame\s+fisico/i,
    /sinais\s+vitais/i,
    /\bpa\b/i,
    /\bfc\b/i,
    /\bfr\b/i,
    /saturacao/i,
  ])) || null;
}

function calculateSectionBasedScore(sections) {
  const scorableSections = sections.filter((section) => (
    section.status !== 'not_applicable' &&
    typeof section.score === 'number' &&
    typeof section.maxScore === 'number' &&
    section.maxScore > 0
  ));

  if (!scorableSections.length) {
    return null;
  }

  const earned = scorableSections.reduce((sum, section) => sum + Math.max(0, section.score), 0);
  const possible = scorableSections.reduce((sum, section) => sum + Math.max(0, section.maxScore), 0);

  if (!possible) {
    return null;
  }

  return normalizeScore((earned / possible) * 100);
}

function detectEmergencyRisk(contextText) {
  const normalized = normalizeForSearch(contextText);

  return EMERGENCY_RISK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function detectObjectiveExamEvidence(contextText) {
  const normalized = normalizeForSearch(contextText);

  return OBJECTIVE_EXAM_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getScoreCap({ sections, contextText }) {
  const counts = getSectionStatusCounts(sections);
  const hasEmergencyRisk = detectEmergencyRisk(contextText);
  const hasObjectiveExamEvidence = detectObjectiveExamEvidence(contextText);
  const objectiveExamSection = findObjectiveExamSection(sections);
  const objectiveExamMissing = objectiveExamSection?.status === 'missing' || (
    hasEmergencyRisk &&
    !hasObjectiveExamEvidence &&
    !objectiveExamSection
  );
  const caps = [];

  if (hasEmergencyRisk && objectiveExamMissing) {
    caps.push(68);
  }

  if (counts.missing >= 2) {
    caps.push(70);
  }

  if (counts.missing >= 1 && counts.partial >= 1) {
    caps.push(78);
  }

  return caps.length ? Math.min(...caps) : null;
}

function recalibrateScore({ score, sections, contextText }) {
  const sectionScore = calculateSectionBasedScore(sections);
  const scoreCap = getScoreCap({ sections, contextText });
  const candidates = [score];

  if (sectionScore !== null) {
    candidates.push(sectionScore);
  }

  if (scoreCap !== null) {
    candidates.push(scoreCap);
  }

  return {
    score: Math.min(...candidates),
    sectionScore,
    scoreCap,
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeUnifiedAnalysisPayload(payload, context = {}) {
  const score = normalizeScore(payload?.score);

  if (score === null) {
    throw new Error('invalid_unified_analysis_score');
  }

  const sections = normalizeSections(payload?.sections);
  const criticalInsight = firstText(
    payload?.criticalInsight,
    payload?.critical_insight,
    buildCriticalInsightFromObject(payload?.priorityInsight || payload?.priority_insight),
  );
  const message = firstText(
    payload?.message,
    payload?.scoreLabel,
    payload?.score_label,
    `Estrutura avaliada com nota ${score}/100.`,
  );
  const justification = firstText(
    payload?.justification,
    payload?.summary,
    payload?.analysis,
  );
  const otherGaps = normalizeArray(payload?.otherGaps || payload?.other_gaps, 4);
  const confidence = normalizeConfidence(payload?.confidence);
  const recalibrated = recalibrateScore({
    score,
    sections,
    contextText: [
      context.originalText,
      context.structuredText,
    ].filter(Boolean).join('\n'),
  });
  const finalScore = recalibrated.score;
  const scoreLabel = getScoreLabel(finalScore);
  const scoreAdjusted = finalScore !== score;

  if (!message || !justification || !criticalInsight) {
    throw new Error('incomplete_unified_analysis_payload');
  }

  return {
    score: finalScore,
    interpretation: {
      message: scoreAdjusted
        ? `${scoreLabel}. Lacunas estruturais relevantes limitaram a nota final.`
        : message,
      justification,
      criticalInsight,
      otherGaps,
    },
    unifiedAnalysis: {
      score: finalScore,
      rawScore: score,
      sectionScore: recalibrated.sectionScore,
      scoreCap: recalibrated.scoreCap,
      scoreAdjusted,
      scoreLabel,
      confidence,
      sections,
      otherGaps,
    },
  };
}

function parseUnifiedAnalysisResponse(rawText, context = {}) {
  return normalizeUnifiedAnalysisPayload(extractJsonObject(rawText), context);
}

module.exports = {
  parseUnifiedAnalysisResponse,
  normalizeUnifiedAnalysisPayload,
};
