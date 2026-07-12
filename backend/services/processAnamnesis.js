const OpenAI = require('openai');
const { getTemplateById, isPotentialOfficialTemplateId, resolveTemplateById } = require('./templates');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const { buildStructurePrompt } = require('../prompts/structurePrompt');
const {
  getPublishedDefaultPromptByType,
  getPublishedPromptByCategoryAndType,
} = require('./officialPrompts');
const {
  LEGACY_ANALYSIS_ENGINE,
  getLatestAnamneseMetric,
  registerAnamneseMetric,
} = require('./anamneseMetrics');
const { getTextLimitError } = require('../utils/requestLimits');
const { sanitizeText } = require('../utils/textSanitization');
const { isCustomTemplateId } = require('./userTemplates');

function validateProcessAnamnesisInput(payload) {
  const { template, texto } = payload || {};

  if (
    !template ||
    typeof template !== 'string' ||
    (!getTemplateById(template) && !isPotentialOfficialTemplateId(template) && !isCustomTemplateId(template))
  ) {
    return 'Template inválido. Escolha um dos templates disponíveis.';
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'O texto não pode estar vazio.';
  }

  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return textLimitError.message;
  }

  return null;
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

function shouldRecordOrganizationMetric() {
  const configuredEngine = String(process.env.ANALYSIS_ENGINE || 'unified_ai')
    .trim()
    .toLowerCase();

  return ['legacy', 'legacy_deterministic', 'deterministic', 'off', 'false'].includes(configuredEngine);
}

async function processAnamnesis({ template, texto, userId }) {
  const validationError = validateProcessAnamnesisInput({ template, texto });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('Erro interno ao processar a anamnese.');
    error.statusCode = 500;
    throw error;
  }

  const templateConfig = await resolveTemplateById(template, userId);

  if (!templateConfig) {
    const error = new Error('Template inválido. Escolha um dos templates disponíveis.');
    error.statusCode = 400;
    throw error;
  }

  const openai = new OpenAI({ apiKey });
  const sanitizedText = sanitizeText(texto).trim();
  const shouldRecordMetric = shouldRecordOrganizationMetric();
  const previousMetric = shouldRecordMetric
    ? await getLatestAnamneseMetric(userId, { analysisEngine: LEGACY_ANALYSIS_ENGINE }).catch(() => null)
    : null;
  const categoryKey = templateConfig.categoryKey || templateConfig.clinicalCategoryKey || '';
  const [categoryStructurePrompt, defaultStructurePrompt] = await Promise.all([
    getPublishedPromptByCategoryAndType(categoryKey, 'structure_system').catch(() => null),
    getPublishedDefaultPromptByType('structure_system').catch(() => null),
  ]);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: buildStructurePrompt(templateConfig, {
          categoryPrompt: categoryStructurePrompt?.promptBody || null,
          defaultPrompt: defaultStructurePrompt?.promptBody || null,
        }),
      },
      {
        role: 'user',
        content: `Template: ${templateConfig.nome}\n\nTexto:\n${sanitizedText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });

  const resultado = sanitizeText(response.choices?.[0]?.message?.content || '').trim();

  if (!resultado) {
    const error = new Error('Erro interno ao processar a anamnese.');
    error.statusCode = 500;
    throw error;
  }

  // O score determinístico da organização só é consumido no modo legacy (que
  // grava métrica e comparação aqui). No motor unificado o score nasce em
  // /insights — computá-lo aqui era trabalho descartado pelo frontend.
  const qualityScore = shouldRecordMetric
    ? calculateAnamnesisQualityScore(resultado, template, templateConfig)
    : { score: null };

  const metricRecorded = shouldRecordMetric ? await registerAnamneseMetric({
    userId,
    template,
    score: qualityScore.score,
    textLength: sanitizedText.length,
    hasTeaser: false,
    analysisEngine: LEGACY_ANALYSIS_ENGINE,
  }).catch((error) => {
    console.error('processAnamnesis: failed to persist metric', {
      userId: userId || null,
      template,
      message: error?.message || 'unknown_error',
    });
    return false;
  }) : false;

  const previousScore = typeof previousMetric?.score === 'number' ? previousMetric.score : null;
  const comparison = shouldRecordMetric ? {
    currentScore: qualityScore.score,
    previousScore,
    trend: getTrendFromScores(previousScore, qualityScore.score),
    comparisonBase: previousMetric
      ? {
          source: 'immediate_previous_persisted_anamnese',
          previousAnamneseId: previousMetric.id,
          previousTemplate: previousMetric.template,
          previousCreatedAt: previousMetric.created_at,
        }
      : {
          source: 'no_previous_persisted_anamnese',
        },
  } : null;

  return {
    resultado,
    score: qualityScore.score,
    comparison,
    metricRecorded,
  };
}

module.exports = {
  processAnamnesis,
  validateProcessAnamnesisInput,
};
