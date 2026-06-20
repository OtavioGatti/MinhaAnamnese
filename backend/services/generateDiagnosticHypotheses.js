const crypto = require('crypto');
const OpenAI = require('openai');
const {
  buildRefusalResult,
  DIAGNOSTIC_HYPOTHESES_SCHEMA,
  normalizeDiagnosticHypotheses,
} = require('../contracts/diagnosticHypotheses');
const {
  buildDiagnosticHypothesesInput,
  buildDiagnosticHypothesesInstructions,
} = require('../prompts/diagnosticHypothesesPrompt');
const { getSyncedOfficialPrompt } = require('./officialPrompts');
const { findPrescriptionGuideForHypothesis } = require('./prescriptionGuides');
const { resolveTemplateById } = require('./templates');
const { sanitizeText } = require('../utils/textSanitization');

const DEFAULT_MODEL = 'gpt-4o';
const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini']);

function isDiagnosticHypothesesEnabled() {
  return String(process.env.DIAGNOSTIC_HYPOTHESES_ENABLED || 'true').toLowerCase() !== 'false';
}

function resolveDiagnosticModel(cmsModel) {
  const configuredModel = String(process.env.DIAGNOSTIC_MODEL || cmsModel || DEFAULT_MODEL).trim();
  return ALLOWED_MODELS.has(configuredModel) ? configuredModel : DEFAULT_MODEL;
}

function validateDiagnosticHypothesesInput({ template, structuredText }) {
  if (!template || typeof template !== 'string') {
    return 'Selecione um modelo clínico válido.';
  }

  if (!structuredText || typeof structuredText !== 'string' || !structuredText.trim()) {
    return 'Organize a anamnese antes de solicitar hipóteses diagnósticas.';
  }

  return null;
}

function createSafetyIdentifier(userId) {
  return crypto
    .createHash('sha256')
    .update(`minha-anamnese:${String(userId || 'anonymous')}`)
    .digest('hex');
}

function extractResponseRefusal(response) {
  for (const outputItem of response?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (contentItem?.type === 'refusal' && contentItem.refusal) {
        return String(contentItem.refusal);
      }
    }
  }

  return '';
}

function extractResponseText(response) {
  if (response?.output_text) {
    return String(response.output_text);
  }

  for (const outputItem of response?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (contentItem?.type === 'output_text' && contentItem.text) {
        return String(contentItem.text);
      }
    }
  }

  return '';
}

function parseDiagnosticResponse(response) {
  const refusal = extractResponseRefusal(response);

  if (refusal) {
    return buildRefusalResult(refusal);
  }

  const responseText = extractResponseText(response).trim();

  if (!responseText) {
    const error = new Error('A análise não retornou conteúdo utilizável.');
    error.statusCode = 502;
    throw error;
  }

  try {
    return normalizeDiagnosticHypotheses(JSON.parse(responseText));
  } catch {
    const error = new Error('A análise retornou um formato inválido.');
    error.statusCode = 502;
    throw error;
  }
}

function parseChatCompletionResponse(completion) {
  const message = completion?.choices?.[0]?.message || {};

  if (message.refusal) {
    return buildRefusalResult(message.refusal);
  }

  return parseDiagnosticResponse({ output_text: message.content || '' });
}

function shouldFallbackToChatCompletions(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 401 && message.includes('api.responses.write');
}

async function createStructuredDiagnosticResponse({
  openai,
  model,
  instructions,
  input,
  safetyIdentifier,
  promptVersion,
}) {
  try {
    const response = await openai.responses.create({
      model,
      instructions,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'diagnostic_hypotheses',
          strict: true,
          schema: DIAGNOSTIC_HYPOTHESES_SCHEMA,
        },
      },
      max_output_tokens: 2200,
      store: false,
      safety_identifier: safetyIdentifier,
      metadata: {
        feature: 'diagnostic_hypotheses',
        prompt_version: String(promptVersion || 0),
      },
    });

    return {
      parsed: parseDiagnosticResponse(response),
      apiSurface: 'responses',
    };
  } catch (error) {
    if (!shouldFallbackToChatCompletions(error)) {
      throw error;
    }
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: input },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'diagnostic_hypotheses',
        strict: true,
        schema: DIAGNOSTIC_HYPOTHESES_SCHEMA,
      },
    },
    max_tokens: 2200,
    store: false,
    safety_identifier: safetyIdentifier,
  });

  return {
    parsed: parseChatCompletionResponse(completion),
    apiSurface: 'chat_completions_fallback',
  };
}

async function attachPrescriptionGuides(hypotheses) {
  return Promise.all((hypotheses || []).map(async (hypothesis) => {
    const prescriptionGuide = await findPrescriptionGuideForHypothesis(hypothesis.name)
      .catch(() => null);

    return {
      ...hypothesis,
      prescriptionGuide,
    };
  }));
}

async function generateDiagnosticHypotheses({ template, structuredText, userId }) {
  const validationError = validateDiagnosticHypothesesInput({ template, structuredText });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  if (!isDiagnosticHypothesesEnabled()) {
    const error = new Error('A sugestão de hipóteses está temporariamente indisponível.');
    error.statusCode = 503;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('A integração clínica com IA não está configurada.');
    error.statusCode = 503;
    throw error;
  }

  const templateConfig = await resolveTemplateById(template, userId);

  if (!templateConfig) {
    const error = new Error('Selecione um modelo clínico válido.');
    error.statusCode = 400;
    throw error;
  }

  const sanitizedHistory = sanitizeText(structuredText).trim();
  const syncedPrompt = await getSyncedOfficialPrompt('diagnostic_hypotheses_system')
    .catch(() => null);
  const model = resolveDiagnosticModel(syncedPrompt?.model);
  const openai = new OpenAI({ apiKey });
  const instructions = buildDiagnosticHypothesesInstructions(syncedPrompt?.promptBody);
  const input = buildDiagnosticHypothesesInput({
    structuredHistory: sanitizedHistory,
    templateName: templateConfig.nome,
    clinicalCategory: templateConfig.categoryKey || templateConfig.clinicalCategoryKey || '',
  });
  const generationResponse = await createStructuredDiagnosticResponse({
    openai,
    model,
    instructions,
    input,
    safetyIdentifier: createSafetyIdentifier(userId),
    promptVersion: syncedPrompt?.version || 0,
  });
  const parsed = generationResponse.parsed;
  const hypotheses = await attachPrescriptionGuides(parsed.hypotheses);

  return {
    ...parsed,
    hypotheses,
    generation: {
      model,
      promptVersion: syncedPrompt?.version || 0,
      promptSource: syncedPrompt ? 'notion_cms' : 'local_fallback',
      apiSurface: generationResponse.apiSurface,
    },
  };
}

module.exports = {
  createStructuredDiagnosticResponse,
  createSafetyIdentifier,
  generateDiagnosticHypotheses,
  isDiagnosticHypothesesEnabled,
  parseDiagnosticResponse,
  parseChatCompletionResponse,
  resolveDiagnosticModel,
  shouldFallbackToChatCompletions,
  validateDiagnosticHypothesesInput,
};
