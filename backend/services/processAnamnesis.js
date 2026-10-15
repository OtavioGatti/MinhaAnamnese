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
const {
  preservaAchadosDoExame,
  removeLinhasVaziasDoExame,
} = require('../utils/examSectionCleanup');
const { isCustomTemplateId } = require('./userTemplates');
const { normalizeMissingMarkers } = require('../utils/missingMarkers');
const { hasUnexpectedForeignScript } = require('../utils/openaiModels');

// Modelo do organizar. A OpenAI desliga o gpt-4o-mini em 14/01/2027.
// Comparação de 15/10/2026 (55 organizações por modelo, sem raciocínio):
// - gpt-5.4-mini: 0 falhas, 1,2 s, ~US$ 0,002 por organização — o escolhido;
// - gpt-5.6-luna: 1 falha de formato, 2,2 s, ~US$ 0,0005;
// - gpt-6-luna: perdeu "fala frases curtas" (asma) em 2 de 6 rodadas — fora;
// - gpt-5.4-nano: inventou negativas e sai em 04/2027 — fora.
// Troca e volta pelo Render: ORGANIZE_MODEL=gpt-5.4-mini | gpt-4o-mini.
const DEFAULT_ORGANIZE_MODEL = 'gpt-4o-mini';
const ALLOWED_ORGANIZE_MODELS = new Set(['gpt-4o-mini', 'gpt-5.4-mini', 'gpt-5.6-luna', 'gpt-6-luna']);
const REASONING_ORGANIZE_MODELS = new Set(['gpt-5.4-mini', 'gpt-5.6-luna', 'gpt-6-luna']);
const ORGANIZE_MAX_OUTPUT_TOKENS = 2048;

function resolveOrganizeModel() {
  const configured = String(process.env.ORGANIZE_MODEL || DEFAULT_ORGANIZE_MODEL).trim();
  return ALLOWED_ORGANIZE_MODELS.has(configured) ? configured : DEFAULT_ORGANIZE_MODEL;
}

// Modelos de raciocínio recusam temperature e max_tokens.
function buildOrganizeModelParams(model) {
  if (REASONING_ORGANIZE_MODELS.has(model)) {
    return { model, reasoning_effort: 'none', max_completion_tokens: ORGANIZE_MAX_OUTPUT_TOKENS };
  }

  return { model, temperature: 0.1, max_tokens: ORGANIZE_MAX_OUTPUT_TOKENS };
}

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

  const model = resolveOrganizeModel();
  const request = {
    ...buildOrganizeModelParams(model),
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
  };
  let response = await openai.chat.completions.create(request);

  // Palavra de outro alfabeto que não estava no texto: refaz uma vez.
  if (hasUnexpectedForeignScript(response.choices?.[0]?.message?.content, sanitizedText)) {
    response = await openai.chat.completions.create(request);
  }

  // Garantia determinística de que sistema não examinado não vira linha vazia
  // no exame físico. O prompt pede isso, mas pedir não garante: sobravam 2-3
  // linhas "SSVV: [Não relatado]" por geração mesmo depois de três rodadas de
  // ajuste no texto (código e CMS). Ver utils/examSectionCleanup.js.
  // Rede de segurança contra o pior defeito possível aqui: achado do médico
  // sumindo. Aconteceu de verdade — "C+P: Tireoide..." foi encaixado em AP e
  // sobrescreveu "AP: Murmúrios abolidos em base, estertorando difusamente",
  // que desapareceu. O prompt já foi corrigido, mas prompt é pedido, não
  // garantia. Ver utils/examSectionCleanup.js.
  // Antes de tudo, a grafia do marcador de seção vazia é padronizada: prompt do
  // CMS já pediu "[nao relatado]" sem acento. Ver utils/missingMarkers.js.
  const resultado = preservaAchadosDoExame(
    removeLinhasVaziasDoExame(
      normalizeMissingMarkers(sanitizeText(response.choices?.[0]?.message?.content || '').trim()),
      templateConfig?.secoes,
    ),
    sanitizedText,
    templateConfig?.secoes,
  );

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
    // Para acompanhar a troca de modelo pelos eventos de uso.
    model,
  };
}

module.exports = {
  buildOrganizeModelParams,
  processAnamnesis,
  resolveOrganizeModel,
  validateProcessAnamnesisInput,
};
