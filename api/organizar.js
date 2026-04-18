const OpenAI = require('openai');
const templates = require('../backend/templates/templates');
const { evaluateAnamnesisQuality } = require('../backend/utils/anamnesisQualityScore');
const { registerAnamneseMetric } = require('./_anamneses');

function buildTemplateStructure(template) {
  return template.secoes.map((section) => `### ${section}`).join('\n');
}

function validateRequestBody(body) {
  const { template, texto } = body || {};

  if (!template || !templates[template]) {
    return 'Template inválido. Escolha um dos templates disponíveis.';
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'O texto não pode estar vazio.';
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido',
    });
  }

  const validationError = validateRequestBody(req.body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      error: validationError,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar a anamnese.',
    });
  }

  const { template, texto, userId } = req.body;
  const modelo = templates[template];
  const openai = new OpenAI({ apiKey });

  try {
    const estrutura = buildTemplateStructure(modelo);
    const systemPrompt = modelo.promptSistema || `Você é um médico que organiza anamneses. Não invente informações. Se faltar dado escreva 'Não informado'. Use linguagem médica técnica e organize conforme o modelo.

Estrutura obrigatória:
${estrutura}`;

    const userPrompt = `Template: ${modelo.nome}

Texto:
${texto}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const resultado = response.choices?.[0]?.message?.content;

    if (!resultado) {
      throw new Error('empty organizar response');
    }

    const qualityScore = evaluateAnamnesisQuality(texto.trim(), template);

    registerAnamneseMetric({
      userId,
      template,
      score: qualityScore.shouldShowScore ? qualityScore.score : null,
      textLength: texto.trim().length,
      hasTeaser: qualityScore.teaser?.shouldShowTeaser,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        resultado,
      },
    });
  } catch (error) {
    console.error('organizar: failed to process anamnese', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar a anamnese.',
    });
  }
};
