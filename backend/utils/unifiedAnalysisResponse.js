const { sanitizeText } = require('./textSanitization');

const ALLOWED_SECTION_STATUSES = new Set(['present', 'partial', 'missing', 'not_applicable']);

function normalizeText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
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

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeUnifiedAnalysisPayload(payload) {
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

  if (!message || !justification || !criticalInsight) {
    throw new Error('incomplete_unified_analysis_payload');
  }

  return {
    score,
    interpretation: {
      message,
      justification,
      criticalInsight,
      otherGaps,
    },
    unifiedAnalysis: {
      score,
      scoreLabel: firstText(payload?.scoreLabel, payload?.score_label, message),
      confidence,
      sections,
      otherGaps,
    },
  };
}

function parseUnifiedAnalysisResponse(rawText) {
  return normalizeUnifiedAnalysisPayload(extractJsonObject(rawText));
}

module.exports = {
  parseUnifiedAnalysisResponse,
  normalizeUnifiedAnalysisPayload,
};
