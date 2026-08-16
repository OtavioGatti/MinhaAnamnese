// Correção/completar de um exame existente (Status Automação = "a corrigir").
// Espelha services/correctManeuver.js.

const OpenAI = require('openai');
const {
  COMPLETABLE_FIELDS,
  FIELD_TO_NOTION,
  MODEL_GENERATED_FIELDS,
  STATUS_AUTOMACAO_CORRIGIDO,
  applyExamLock,
  buildExamSchema,
  isFieldEmpty,
  normalizeExam,
} = require('../contracts/examAutomation');
const {
  buildExamCorrectionInput,
  buildExamCorrectionInstructions,
} = require('../prompts/examPrompt');
const {
  getExamEnumOptions,
  isNotionExamsConfigured,
} = require('./notionExamSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');
const { resolveExamModel } = require('./generateExam');

const LOCK_FIELDS = ['automation_status', 'review_status'];

function pickCurrentExam(fields) {
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
  const instruction = `Preencha, com base em prática clínica consolidada, APENAS os campos a seguir que estão vazios, sem alterar nenhum campo já preenchido: ${labels}. Se não for seguro afirmar algum deles, deixe-o vazio.`;

  return { instruction, mode: 'auto', emptyFields };
}

async function correctExamFromFields(fields) {
  const { instruction, mode, emptyFields } = resolveCorrectionInstruction(fields);

  if (!instruction) {
    const error = new Error('Nada a completar: o exame não tem campos vazios e não há instrução de correção.');
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

  if (isNotionExamsConfigured()) {
    try {
      enumOptions = (await getExamEnumOptions()).options;
    } catch (_error) {
      // segue com enum livre
    }
  }

  const currentExam = pickCurrentExam(fields);
  const schema = buildExamSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveExamModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildExamCorrectionInstructions(),
    input: buildExamCorrectionInput({ currentExam, instruction, enumOptions }),
    schema,
  });

  const currentNorm = normalizeExam(currentExam, enumOptions);
  const nextNorm = normalizeExam(generation.raw, enumOptions);
  const changedFields = diffChangedFields(currentNorm, nextNorm);

  const exam = applyExamLock(nextNorm, { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO });
  const writeFields = Array.from(new Set([...changedFields, ...LOCK_FIELDS]));

  return {
    exam,
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
  correctExamFromFields,
  diffChangedFields,
  getEmptyCompletableFields,
  pickCurrentExam,
  resolveCorrectionInstruction,
};
