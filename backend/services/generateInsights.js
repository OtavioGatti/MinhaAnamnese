const OpenAI = require('openai');
const { getTemplateById, isPotentialOfficialTemplateId, resolveTemplateById } = require('./templates');
const { buildInsightPrompt } = require('../prompts/insightPrompt');
const { buildUnifiedAnalysisPrompt } = require('../prompts/unifiedAnalysisPrompt');
const { getSyncedOfficialPrompt } = require('./officialPrompts');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const {
  buildInsightGuardrailContext,
  sanitizeParsedInsightResponse,
} = require('../utils/insightGuardrails');
const { parseUnifiedAnalysisResponse } = require('../utils/unifiedAnalysisResponse');
const { parseAIResponse } = require('../utils/parseAIResponse');
const { getTextLimitError } = require('../utils/requestLimits');
const { sanitizeText } = require('../utils/textSanitization');
const { isCustomTemplateId } = require('./userTemplates');
const {
  DEFAULT_ANALYSIS_ENGINE,
  getLatestAnamneseMetric,
  registerAnamneseMetric,
} = require('./anamneseMetrics');

const DEBUG_MODE = process.env.DEBUG_INSIGHTS === 'true';
const UNIFIED_ANALYSIS_PROMPT_SLUG = 'unified_anamnesis_analysis_user';

function resolveOpenAiModel(value, fallback = 'gpt-4o') {
  const model = String(value || '').trim();

  return /^gpt-[a-z0-9.-]+$/i.test(model) ? model : fallback;
}

function getTrendFromScores(previousScore, currentScore) {
  if (typeof previousScore !== 'number' || Number.isNaN(previousScore)) {
    return 'insufficient_data';
  }

  if (currentScore > previousScore) {
    return 'up';
  }

  if (currentScore < previousScore) {
    return 'down';
  }

  return 'stable';
}

function buildMetricComparison(previousMetric, currentScore) {
  const previousScore = typeof previousMetric?.score === 'number' ? previousMetric.score : null;

  return {
    currentScore,
    previousScore,
    trend: getTrendFromScores(previousScore, currentScore),
    comparisonBase: previousMetric
      ? {
          source: 'immediate_previous_unified_analysis',
          previousAnamneseId: previousMetric.id,
          previousTemplate: previousMetric.template,
          previousCreatedAt: previousMetric.created_at,
        }
      : {
          source: 'no_previous_unified_analysis',
        },
  };
}

function normalizeText(value) {
  return sanitizeText(String(value || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatGapLabel(section) {
  if (!section) {
    return '';
  }

  if (section.status === 'partial') {
    return `${section.label} pouco detalhada`;
  }

  return `${section.label} ausente`;
}

function getRankedSemanticGaps(analysis) {
  const sectionReadout = Array.isArray(analysis?.sectionReadout) ? analysis.sectionReadout : [];
  const priorityOrder = {
    essential: 0,
    important: 1,
    contextual: 2,
    optional: 3,
  };
  const statusOrder = {
    missing: 0,
    partial: 1,
    present: 2,
  };

  return sectionReadout
    .filter((section) => section.status !== 'present' && section.priority !== 'optional')
    .sort((left, right) => {
      const priorityDiff = (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9);
    });
}

function buildDeterministicInterpretation(score, analysis) {
  const rankedGaps = getRankedSemanticGaps(analysis);
  const primary = rankedGaps[0] || null;
  const secondary = rankedGaps[1] || null;

  if (!primary) {
    return {
      message: `A estrutura está consistente e sem lacunas estruturais relevantes no momento.`,
      justification: `A anamnese está bem organizada, sem contradições estruturais importantes entre os blocos essenciais e o restante do registro.`,
      criticalInsight: `FALHA -> Nenhuma lacuna estrutural dominante identificada -> IMPACTO NA QUALIDADE -> Mantém a leitura clara do caso -> ACAO DIRETA -> Preserve esse padrão de documentação nas próximas coletas.`,
      otherGaps: [],
    };
  }

  const primaryLabel = formatGapLabel(primary);
  const secondaryLabel = secondary ? formatGapLabel(secondary) : '';
  const message = score >= 86
    ? `A estrutura está consistente, mas ainda há um ponto específico de refinamento documental.`
    : score >= 71
      ? `A estrutura é boa, mas ainda há lacunas relevantes que limitam parte da leitura do caso.`
      : score >= 51
        ? `A estrutura é limitada porque ainda faltam elementos importantes para uma leitura mais sólida do caso.`
        : `A estrutura está insuficiente porque faltam elementos relevantes para uma leitura segura e completa do caso.`;
  const justification = secondary
    ? `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} compromete a leitura estrutural do caso, e ${secondaryLabel} reforça essa perda de clareza documental. Na próxima coleta, priorize esses blocos para melhorar a consistência e a utilidade do registro.`
    : `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} compromete a leitura estrutural do caso e reduz a clareza documental do registro. Na próxima coleta, priorize esse bloco para melhorar a consistência e a utilidade da anamnese.`;
  const criticalInsight = primary.status === 'partial'
    ? `FALHA -> ${primary.label} pouco detalhada -> CONSEQUENCIA NA LEITURA -> Deixa a compreensão do caso incompleta -> IMPACTO NA QUALIDADE -> Reduz a clareza documental -> ACAO DIRETA -> Detalhe melhor ${primary.label.toLowerCase()} na próxima coleta.`
    : `FALHA -> ${primary.label} ausente -> CONSEQUENCIA NA LEITURA -> Remove uma referência importante para entender o caso -> IMPACTO NA QUALIDADE -> Reduz a segurança documental -> ACAO DIRETA -> Inclua ${primary.label.toLowerCase()} na próxima coleta.`;
  const otherGaps = rankedGaps.slice(1, 4).map((section) => formatGapLabel(section));

  return {
    message,
    justification,
    criticalInsight,
    otherGaps,
  };
}

function hasSemanticContradiction(text, analysis) {
  const normalizedText = normalizeText(text);
  const sectionReadout = Array.isArray(analysis?.sectionReadout) ? analysis.sectionReadout : [];

  if (!normalizedText) {
    return false;
  }

  if (normalizedText.includes('historia social')) {
    return true;
  }

  return sectionReadout.some((section) => {
    const normalizedLabel = normalizeText(section.label);

    if (!normalizedLabel) {
      return false;
    }

    if (section.status === 'present') {
      return (
        normalizedText.includes(normalizedLabel)
        && /(ausen|falta|nao ha|nao tem|nao foi registrad|nao registrad)/i.test(normalizedText)
      );
    }

    if (section.status === 'partial') {
      return (
        normalizedText.includes(normalizedLabel)
        && /(ausen|nao registrad)/i.test(normalizedText)
      );
    }

    return false;
  });
}

function shouldUseDeterministicInterpretation(parsed, analysis) {
  const combinedText = [
    parsed?.scoreText,
    parsed?.analise,
    parsed?.insight,
    ...(Array.isArray(parsed?.outrosList) ? parsed.outrosList : []),
  ].join(' \n ');

  return hasSemanticContradiction(combinedText, analysis);
}

function hasUsableCriticalInsight(insight) {
  const normalizedInsight = normalizeText(insight);

  return (
    normalizedInsight.length >= 40 &&
    normalizedInsight.includes('falha') &&
    normalizedInsight.includes('acao')
  );
}

function findMentionedSection(gap, sectionReadout) {
  const normalizedGap = normalizeText(gap);

  return sectionReadout.find((section) => {
    const normalizedLabel = normalizeText(section.label);
    return normalizedGap.includes(normalizedLabel) || normalizedLabel.includes(normalizedGap);
  }) || null;
}

function filterOtherGapsByAnalysis(otherGaps, analysis) {
  if (!Array.isArray(otherGaps) || !analysis) {
    return [];
  }

  const sectionReadout = Array.isArray(analysis.sectionReadout) ? analysis.sectionReadout : [];

  return otherGaps.filter((gap) => {
    const section = findMentionedSection(gap, sectionReadout);

    if (!section) {
      return true;
    }

    const normalizedGap = normalizeText(gap);

    if (section.status === 'present') {
      return false;
    }

    if (section.priority === 'optional') {
      return false;
    }

    if (section.status === 'partial' && /(ausent|nao registrad)/i.test(normalizedGap)) {
      return false;
    }

    return true;
  });
}

function validateGenerateInsightsInput(payload) {
  const { texto, templateId } = payload || {};

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'Texto inv\u00e1lido';
  }

  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return textLimitError.message;
  }

  if (
    !templateId ||
    typeof templateId !== 'string' ||
    (!getTemplateById(templateId) && !isPotentialOfficialTemplateId(templateId) && !isCustomTemplateId(templateId))
  ) {
    return 'Template inv\u00e1lido';
  }

  return null;
}

function shouldUseUnifiedAnalysisEngine() {
  const configuredEngine = String(process.env.ANALYSIS_ENGINE || 'unified_ai')
    .trim()
    .toLowerCase();

  return !['legacy', 'legacy_deterministic', 'deterministic', 'off', 'false'].includes(configuredEngine);
}

async function generateUnifiedInsights({
  openai,
  trimmedText,
  originalText,
  templateConfig,
  templateId,
  userId,
}) {
  const syncedPrompt = await getSyncedOfficialPrompt(UNIFIED_ANALYSIS_PROMPT_SLUG).catch(() => null);
  const prompt = buildUnifiedAnalysisPrompt({
    originalText,
    structuredText: trimmedText,
    templateConfig,
    promptTemplate: syncedPrompt?.promptBody || null,
  });
  const response = await openai.chat.completions.create({
    model: resolveOpenAiModel(syncedPrompt?.model),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    top_p: 1,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
  });
  const rawAnalysis = sanitizeText(response.choices?.[0]?.message?.content || '').trim();
  const data = parseUnifiedAnalysisResponse(rawAnalysis, {
    originalText,
    structuredText: trimmedText,
  });
  const previousMetric = await getLatestAnamneseMetric(userId, {
    analysisEngine: DEFAULT_ANALYSIS_ENGINE,
  }).catch(() => null);
  const metricRecorded = await registerAnamneseMetric({
    userId,
    template: templateId,
    score: data.score,
    textLength: sanitizeText(originalText || trimmedText).trim().length,
    hasTeaser: false,
    analysisEngine: DEFAULT_ANALYSIS_ENGINE,
  }).catch((error) => {
    console.error('insights: failed to persist unified analysis metric', {
      userId: userId || null,
      templateId,
      message: error?.message || 'unknown_error',
    });
    return false;
  });
  const comparison = buildMetricComparison(previousMetric, data.score);

  if (DEBUG_MODE) {
    console.log('insights: unified analysis debug summary', {
      templateId,
      templateName: templateConfig.nome,
      score: data.score,
      promptSource: syncedPrompt ? 'official_prompt' : 'runtime_fallback',
      sections: data.unifiedAnalysis.sections.length,
      confidence: data.unifiedAnalysis.confidence,
      metricRecorded,
    });
  }

  return {
    ...data,
    comparison,
    metricRecorded,
    analysisEngine: 'unified_ai',
  };
}

async function generateLegacyInsights({
  openai,
  trimmedText,
  templateConfig,
  templateId,
  userId,
}) {
  const qualityScore = calculateAnamnesisQualityScore(trimmedText, templateId, templateConfig);
  const analysis = qualityScore.structuredAnalysis;

  if (!analysis || typeof qualityScore.score !== 'number') {
    const error = new Error('Erro ao gerar insights');
    error.statusCode = 500;
    throw error;
  }

  const guardrailContext = buildInsightGuardrailContext({
    structuredAnalysis: analysis,
    structuredText: trimmedText,
    score: qualityScore.score,
  });
  const syncedPrompt = await getSyncedOfficialPrompt('insight_analysis_user').catch(() => null);
  const prompt = buildInsightPrompt(
    trimmedText,
    templateConfig.nome,
    qualityScore.score,
    analysis,
    syncedPrompt?.promptBody || null,
    guardrailContext,
  );

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    top_p: 1,
    max_tokens: 1600,
  });

  const insights = sanitizeText(response.choices?.[0]?.message?.content || '').trim();

  if (!insights) {
    const error = new Error('Erro ao gerar insights');
    error.statusCode = 500;
    throw error;
  }

  const parsed = parseAIResponse(insights);

  if (!parsed.analise && !parsed.scoreText && !parsed.insight && !parsed.outros) {
    const error = new Error('Erro ao gerar insights');
    error.statusCode = 500;
    throw error;
  }

  const sanitizedParsed = sanitizeParsedInsightResponse(parsed, guardrailContext.statusMap);

  if (DEBUG_MODE) {
    console.log('insights: debug summary', {
      templateId,
      templateName: templateConfig.nome,
      score: qualityScore.score,
      hasStructuredAnalysis: Boolean(analysis),
      guardrailSections: Object.keys(guardrailContext.statusMap || {}).length,
      parsedSections: {
        analise: Boolean(sanitizedParsed.analise),
        scoreText: Boolean(sanitizedParsed.scoreText),
        insight: Boolean(sanitizedParsed.insight),
        outros: Boolean(sanitizedParsed.outros),
      },
    });
  }

  const filteredOtherGaps = filterOtherGapsByAnalysis(
    Array.isArray(sanitizedParsed.outrosList)
      ? sanitizedParsed.outrosList.map((item) => sanitizeText(item))
      : [],
    analysis,
  );
  const deterministicInterpretation = buildDeterministicInterpretation(qualityScore.score, analysis);
  const interpretation = shouldUseDeterministicInterpretation(sanitizedParsed, analysis) ||
    !hasUsableCriticalInsight(sanitizedParsed.insight)
    ? deterministicInterpretation
    : {
        message: sanitizeText(sanitizedParsed.scoreText),
        justification: sanitizeText(sanitizedParsed.analise),
        criticalInsight: sanitizeText(sanitizedParsed.insight),
        otherGaps: filteredOtherGaps,
      };

  return {
    score: qualityScore.score,
    interpretation,
    analysisEngine: 'legacy',
  };
}

async function generateInsights({ texto, templateId, userId, originalText }) {
  const validationError = validateGenerateInsightsInput({ texto, templateId });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('Erro ao gerar insights');
    error.statusCode = 500;
    throw error;
  }

  const openai = new OpenAI({ apiKey });
  const templateConfig = await resolveTemplateById(templateId, userId);

  if (!templateConfig) {
    const error = new Error('Template inv\u00e1lido');
    error.statusCode = 400;
    throw error;
  }

  const trimmedText = sanitizeText(texto).trim();
  const sanitizedOriginalText = sanitizeText(originalText || '').trim();
  const legacyInput = {
    openai,
    trimmedText,
    templateConfig,
    templateId,
    userId,
  };

  if (!shouldUseUnifiedAnalysisEngine()) {
    return generateLegacyInsights(legacyInput);
  }

  try {
    return await generateUnifiedInsights({
      ...legacyInput,
      originalText: sanitizedOriginalText,
    });
  } catch (error) {
    console.error('insights: unified analysis failed, falling back to legacy engine', {
      templateId,
      message: error?.message || 'unknown_error',
    });

    return generateLegacyInsights(legacyInput);
  }
}

module.exports = {
  generateInsights,
  validateGenerateInsightsInput,
};
