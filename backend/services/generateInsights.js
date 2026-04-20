const OpenAI = require('openai');
const { getTemplateById } = require('./templates');
const { buildInsightPrompt } = require('../prompts/insightPrompt');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const { updateUserHistory } = require('../utils/userHistory');
const { parseAIResponse } = require('../utils/parseAIResponse');
const { sanitizeText } = require('../utils/textSanitization');

const DEBUG_MODE = process.env.DEBUG_INSIGHTS === 'true';

function validateGenerateInsightsInput(payload) {
  const { texto, templateId } = payload || {};

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'Texto inválido';
  }

  if (!templateId || typeof templateId !== 'string' || !getTemplateById(templateId)) {
    return 'Template inválido';
  }

  return null;
}

async function generateInsights({ texto, templateId, userId }) {
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
  const templateConfig = getTemplateById(templateId);
  const trimmedText = sanitizeText(texto).trim();
  const qualityScore = calculateAnamnesisQualityScore(trimmedText);
  const analysis = qualityScore.structuredAnalysis;

  if (!analysis || typeof qualityScore.score !== 'number') {
    const error = new Error('Erro ao gerar insights');
    error.statusCode = 500;
    throw error;
  }

  const prompt = buildInsightPrompt(
    trimmedText,
    templateConfig.nome,
    qualityScore.score,
    analysis,
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

  const history = updateUserHistory(userId, {
    score: qualityScore.score,
    erros: [],
  });

  if (DEBUG_MODE) {
    console.log('insights: debug summary', {
      templateId,
      templateName: templateConfig.nome,
      score: qualityScore.score,
      hasStructuredAnalysis: Boolean(analysis),
      parsedSections: {
        analise: Boolean(parsed.analise),
        scoreText: Boolean(parsed.scoreText),
        insight: Boolean(parsed.insight),
        outros: Boolean(parsed.outros),
      },
      historySize: history.length,
    });
  }

  return {
    score: qualityScore.score,
    interpretation: {
      message: sanitizeText(parsed.scoreText),
      justification: sanitizeText(parsed.analise),
      criticalInsight: sanitizeText(parsed.insight),
    },
  };
}

module.exports = {
  generateInsights,
  validateGenerateInsightsInput,
};
