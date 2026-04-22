const OpenAI = require('openai');
const { getTemplateById } = require('./templates');
const { calculateAnamnesisQualityScore } = require('../utils/anamnesisQualityScore');
const { buildStructurePrompt } = require('../prompts/structurePrompt');
const { registerAnamneseMetric } = require('./anamneseMetrics');
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

  registerAnamneseMetric({
    userId,
    template,
    score: qualityScore.score,
    textLength: sanitizedText.length,
    hasTeaser: false,
  }).catch(() => {});

  return {
    resultado,
    score: qualityScore.score,
  };
}

module.exports = {
  processAnamnesis,
  validateProcessAnamnesisInput,
};
