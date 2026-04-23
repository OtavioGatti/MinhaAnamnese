const OpenAI = require('openai');
const { getTemplateById } = require('./templates');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const { buildStructurePrompt } = require('../prompts/structurePrompt');
const { getLatestAnamneseMetric, registerAnamneseMetric } = require('./anamneseMetrics');
const { sanitizeText } = require('../utils/textSanitization');

function validateProcessAnamnesisInput(payload) {
  const { template, texto } = payload || {};

  if (!template || !getTemplateById(template)) {
    return 'Template inválido. Escolha um dos templates disponíveis.';
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'O texto não pode estar vazio.';
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

  const templateConfig = getTemplateById(template);
  const openai = new OpenAI({ apiKey });
  const sanitizedText = sanitizeText(texto).trim();
  const previousMetric = await getLatestAnamneseMetric(userId).catch(() => null);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildStructurePrompt(templateConfig) },
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

  const qualityScore = calculateAnamnesisQualityScore(sanitizedText, template, templateConfig);

  await registerAnamneseMetric({
    userId,
    template,
    score: qualityScore.score,
    textLength: sanitizedText.length,
    hasTeaser: false,
  }).catch(() => {});

  const previousScore = typeof previousMetric?.score === 'number' ? previousMetric.score : null;
  const comparison = {
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
  };

  return {
    resultado,
    score: qualityScore.score,
    comparison,
  };
}

module.exports = {
  processAnamnesis,
  validateProcessAnamnesisInput,
};
