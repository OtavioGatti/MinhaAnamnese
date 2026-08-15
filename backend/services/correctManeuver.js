// Correção/completar de uma manobra existente (Status Automação = "a corrigir").
//
// Dois modos:
//  - MANUAL: a página tem "Instrução de correção" preenchida -> usa como objetivo.
//  - AUTOMÁTICO: instrução vazia -> detecta os campos de conteúdo VAZIOS e monta
//    uma instrução de "preencher apenas os campos vazios" (auto-completar).
// Em ambos, faz DIFF e escreve só os campos que mudaram (+ os da trava).
//
// Espelha services/correctClinicalDrug.js.

const OpenAI = require('openai');
const {
  COMPLETABLE_FIELDS,
  FIELD_TO_NOTION,
  MODEL_GENERATED_FIELDS,
  STATUS_AUTOMACAO_CORRIGIDO,
  applyManeuverLock,
  buildManeuverSchema,
  isFieldEmpty,
  normalizeManeuver,
} = require('../contracts/maneuverAutomation');
const {
  buildManeuverCorrectionInput,
  buildManeuverCorrectionInstructions,
} = require('../prompts/maneuverPrompt');
const {
  getManeuverEnumOptions,
  isNotionManeuversConfigured,
} = require('./notionManeuverSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');
const { resolveManeuverModel } = require('./generateManeuver');

// Campos de trava sempre reescritos numa correção automática.
const LOCK_FIELDS = ['automation_status', 'review_status'];

function pickCurrentManeuver(fields) {
  const current = {};

  for (const key of MODEL_GENERATED_FIELDS) {
    const value = fields[key];
    current[key] = value == null ? '' : String(value);
  }

  return current;
}

function valuesEqual(a, b) {
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function diffChangedFields(currentNorm, nextNorm) {
  return MODEL_GENERATED_FIELDS.filter((key) => !valuesEqual(currentNorm[key], nextNorm[key]));
}

function getEmptyCompletableFields(fields) {
  return COMPLETABLE_FIELDS.filter((key) => isFieldEmpty(key, fields[key]));
}

function resolveCorrectionInstruction(fields) {
  const manual = String(fields.correction_instruction || '').trim();

  if (manual) {
    return { instruction: manual, mode: 'manual', emptyFields: [] };
  }

  const emptyFields = getEmptyCompletableFields(fields);

  if (emptyFields.length === 0) {
    return { instruction: '', mode: 'auto', emptyFields: [] };
  }

  const labels = emptyFields.map((key) => FIELD_TO_NOTION[key] || key).join(', ');
  const instruction = `Preencha, com base em semiologia consolidada, APENAS os campos a seguir que estão vazios, sem alterar nenhum campo já preenchido: ${labels}. Se não for seguro afirmar algum deles, deixe-o vazio.`;

  return { instruction, mode: 'auto', emptyFields };
}

/**
 * Corrige/completa a manobra a partir dos campos atuais lidos da página. Retorna
 * { maneuver (travada), changedFields, writeFields, instruction, mode, meta }.
 * NÃO escreve no Notion (quem chama decide).
 */
async function correctManeuverFromFields(fields) {
  const { instruction, mode, emptyFields } = resolveCorrectionInstruction(fields);

  if (!instruction) {
    const error = new Error('Nada a completar: a manobra não tem campos vazios e não há instrução de correção.');
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('A integração com IA não está configurada.');
    error.statusCode = 503;
    throw error;
  }

  let enumOptions = { category: [] };

  if (isNotionManeuversConfigured()) {
    try {
      enumOptions = (await getManeuverEnumOptions()).options;
    } catch (_error) {
      // segue com enum livre
    }
  }

  const currentManeuver = pickCurrentManeuver(fields);
  const schema = buildManeuverSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveManeuverModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildManeuverCorrectionInstructions(),
    input: buildManeuverCorrectionInput({ currentManeuver, instruction, enumOptions }),
    schema,
  });

  const currentNorm = normalizeManeuver(currentManeuver, enumOptions);
  const nextNorm = normalizeManeuver(generation.raw, enumOptions);
  const changedFields = diffChangedFields(currentNorm, nextNorm);

  const maneuver = applyManeuverLock(nextNorm, { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO });
  const writeFields = Array.from(new Set([...changedFields, ...LOCK_FIELDS]));

  return {
    maneuver,
    changedFields,
    writeFields,
    instruction,
    mode,
    emptyFields,
    meta: { model, apiSurface: generation.apiSurface },
  };
}

module.exports = {
  LOCK_FIELDS,
  correctManeuverFromFields,
  diffChangedFields,
  getEmptyCompletableFields,
  pickCurrentManeuver,
  resolveCorrectionInstruction,
};
