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
const { findExamByName, listExamNamesForPrompt } = require('./diagnosticExams');
const { findManeuverByName, listManeuverNamesForPrompt } = require('./physicalExamManeuvers');
const { findPrescriptionGuideForHypothesis } = require('./prescriptionGuides');
const { recordUnmatchedHypotheses } = require('./unmatchedHypotheses');
const { recordUnmatchedExams } = require('./unmatchedExams');
const { recordUnmatchedManeuvers } = require('./unmatchedManeuvers');
const { resolveTemplateById } = require('./templates');
const { sanitizeText } = require('../utils/textSanitization');

// A OpenAI desliga gpt-4o, gpt-4o-mini e gpt-4.1-mini em 14/01/2027; o
// substituto é o gpt-6-luna. Comparado em 14/10/2026 com os casos de avaliação:
// sem raciocínio ("none") ele errou menos que o gpt-4o (0 de 9 verificações x 3
// de 9) a ~3% do custo, mas ~2 s mais lento. Raciocinar mais ficou mais lento
// (mediana de 14 s no "medium") sem melhorar o resultado.
//
// Ordem de decisão: DIAGNOSTIC_MODEL (Render) > campo "modelo" do prompt no
// Notion > padrão. Voltar atrás = DIAGNOSTIC_MODEL=gpt-4o (até 14/01/2027).
const DEFAULT_MODEL = 'gpt-6-luna';
const ALLOWED_MODELS = new Set(['gpt-6-luna', 'gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini']);
const REASONING_MODELS = new Set(['gpt-6-luna']);
const ALLOWED_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high']);

function isDiagnosticHypothesesEnabled() {
  return String(process.env.DIAGNOSTIC_HYPOTHESES_ENABLED || 'true').toLowerCase() !== 'false';
}

function resolveDiagnosticModel(cmsModel) {
  const configuredModel = String(process.env.DIAGNOSTIC_MODEL || cmsModel || DEFAULT_MODEL).trim();
  return ALLOWED_MODELS.has(configuredModel) ? configuredModel : DEFAULT_MODEL;
}

// Parâmetros de raciocínio só para modelos que raciocinam (os antigos recusam).
// O raciocínio também consome o limite de saída: com ele ligado, o teto sobe.
function resolveReasoningEffort(model) {
  if (!REASONING_MODELS.has(model)) {
    return null;
  }

  const configured = String(process.env.DIAGNOSTIC_REASONING_EFFORT || 'none').trim().toLowerCase();
  return ALLOWED_REASONING_EFFORTS.has(configured) ? configured : 'none';
}

const BASE_MAX_OUTPUT_TOKENS = 2200;
const REASONING_EXTRA_OUTPUT_TOKENS = 6000;

function resolveMaxOutputTokens(effort) {
  return effort && effort !== 'none'
    ? BASE_MAX_OUTPUT_TOKENS + REASONING_EXTRA_OUTPUT_TOKENS
    : BASE_MAX_OUTPUT_TOKENS;
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

// Chat Completions direto. A chave não tem o escopo api.responses.write: a
// tentativa pela Responses API falhava sempre e só então caía aqui (até
// 15/10/2026), gastando uma ida à OpenAI por geração.
async function createStructuredDiagnosticResponse({
  openai,
  model,
  instructions,
  input,
  safetyIdentifier,
}) {
  const effort = resolveReasoningEffort(model);
  const maxOutputTokens = resolveMaxOutputTokens(effort);
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
    ...(effort
      ? { reasoning_effort: effort, max_completion_tokens: maxOutputTokens }
      : { max_tokens: maxOutputTokens }),
    store: false,
    safety_identifier: safetyIdentifier,
  });

  return {
    parsed: parseChatCompletionResponse(completion),
    apiSurface: 'chat_completions',
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

// Casa cada nome sugerido pela IA com o catálogo revisado. Sem correspondência,
// a manobra continua aparecendo — só o nome, sem técnica nem interpretação — e
// entra no backlog editorial.
async function attachExamManeuvers(hypotheses) {
  return Promise.all((hypotheses || []).map(async (hypothesis) => {
    const names = Array.isArray(hypothesis.suggestedExamManeuvers)
      ? hypothesis.suggestedExamManeuvers
      : [];
    const examManeuvers = await Promise.all(names.map(async (name) => ({
      name,
      maneuver: await findManeuverByName(name).catch(() => null),
    })));

    return {
      ...hypothesis,
      examManeuvers,
    };
  }));
}

// Casa cada exame sugerido com o catálogo revisado. Sem correspondência, o
// exame continua aparecendo — só o nome — e entra no backlog editorial.
async function attachComplementaryExams(hypotheses) {
  return Promise.all((hypotheses || []).map(async (hypothesis) => {
    const names = Array.isArray(hypothesis.suggestedComplementaryExams)
      ? hypothesis.suggestedComplementaryExams
      : [];
    const complementaryExams = await Promise.all(names.map(async (name) => ({
      name,
      exam: await findExamByName(name).catch(() => null),
    })));

    return {
      ...hypothesis,
      complementaryExams,
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
  // Os nomes do catálogo entram no prompt como referência de grafia: o modelo
  // copia em vez de adivinhar, e o pareamento posterior acerta muito mais.
  // Best-effort — sem o catálogo, a IA nomeia livremente como antes.
  const [maneuverNames, examNames] = await Promise.all([
    listManeuverNamesForPrompt().catch(() => []),
    listExamNamesForPrompt().catch(() => []),
  ]);
  const input = buildDiagnosticHypothesesInput({
    structuredHistory: sanitizedHistory,
    templateName: templateConfig.nome,
    clinicalCategory: templateConfig.categoryKey || templateConfig.clinicalCategoryKey || '',
    maneuverNames,
    examNames,
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
  const hypotheses = await attachComplementaryExams(
    await attachExamManeuvers(await attachPrescriptionGuides(parsed.hypotheses)),
  );

  // Backlog editorial do que ainda falta escrever (prescrições e manobras).
  // Best-effort: nunca deve derrubar a análise clínica já pronta.
  await Promise.all([
    recordUnmatchedHypotheses(hypotheses).catch(() => 0),
    recordUnmatchedManeuvers(hypotheses).catch(() => 0),
    recordUnmatchedExams(hypotheses).catch(() => 0),
  ]);

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
  resolveReasoningEffort,
  validateDiagnosticHypothesesInput,
};
