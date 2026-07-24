// Correção/completar de uma bula existente (Status Automação = "a corrigir").
//
// Dois modos:
//  - MANUAL: a página tem "Instrução de correção" preenchida -> usa como objetivo.
//  - AUTOMÁTICO: instrução vazia -> detecta os campos de conteúdo VAZIOS e monta
//    uma instrução de "preencher apenas os campos vazios" (auto-completar).
// Em ambos, faz DIFF e escreve só os campos que mudaram (+ o status da trava).

const OpenAI = require('openai');
const {
  buildClinicalDrugSchema,
  normalizeClinicalDrug,
  applyClinicalDrugLock,
  STATUS_AUTOMACAO_CORRIGIDO,
  MODEL_GENERATED_FIELDS,
  COMPLETABLE_FIELDS,
  FIELD_TO_NOTION,
  isFieldEmpty,
} = require('../contracts/clinicalDrugAutomation');
const {
  buildDrugCorrectionInstructions,
  buildDrugCorrectionInput,
} = require('../prompts/clinicalDrugPrompt');
const {
  getClinicalDrugEnumOptions,
  isNotionClinicalDrugsConfigured,
} = require('./notionClinicalDrugSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');
const { resolveDrugModel } = require('./generateClinicalDrug');

// Campo de trava sempre reescrito numa correção automática.
const LOCK_FIELDS = ['automation_status'];

function pickCurrentDrug(fields) {
  const current = {};
  for (const key of MODEL_GENERATED_FIELDS) {
    const value = fields[key];
    // interaction_pairs pode vir como array (já lido) ou string JSON da página.
    current[key] = value == null ? '' : (typeof value === 'object' ? value : String(value));
  }
  return current;
}

function valuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b) || (a && typeof a === 'object') || (b && typeof b === 'object')) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function diffChangedFields(currentNorm, nextNorm) {
  return MODEL_GENERATED_FIELDS.filter((key) => !valuesEqual(currentNorm[key], nextNorm[key]));
}

// Lista os campos de conteúdo vazios (modo auto-completar).
function getEmptyCompletableFields(fields) {
  return COMPLETABLE_FIELDS.filter((key) => isFieldEmpty(key, fields[key]));
}

// Instrução: manual (se houver) ou auto a partir dos campos vazios.
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
  const instruction = `Preencha, com base em bula oficial, APENAS os campos a seguir que estão vazios, sem alterar nenhum campo já preenchido: ${labels}. Se não for seguro afirmar algum deles, deixe-o vazio.`;

  return { instruction, mode: 'auto', emptyFields };
}

/**
 * Corrige/completa a bula a partir dos campos atuais lidos da página. Retorna
 * { drug (travado), changedFields, writeFields, instruction, mode, meta }.
 * NÃO escreve no Notion (quem chama decide).
 */
async function correctClinicalDrugFromFields(fields) {
  const { instruction, mode, emptyFields } = resolveCorrectionInstruction(fields);

  if (!instruction) {
    const error = new Error('Nada a completar: a bula não tem campos vazios e não há instrução de correção.');
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('A integração com IA não está configurada.');
    error.statusCode = 503;
    throw error;
  }

  let enumOptions = { pregnancy_risk: [] };
  if (isNotionClinicalDrugsConfigured()) {
    try {
      enumOptions = (await getClinicalDrugEnumOptions()).options;
    } catch (_error) {
      // segue com enum livre
    }
  }

  const currentDrug = pickCurrentDrug(fields);
  const schema = buildClinicalDrugSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveDrugModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildDrugCorrectionInstructions(),
    input: buildDrugCorrectionInput({ currentDrug, instruction, enumOptions }),
    schema,
  });

  const currentNorm = normalizeClinicalDrug(currentDrug, enumOptions);
  const nextNorm = normalizeClinicalDrug(generation.raw, enumOptions);
  const changedFields = diffChangedFields(currentNorm, nextNorm);

  const drug = applyClinicalDrugLock(nextNorm, { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO });
  const writeFields = Array.from(new Set([...changedFields, ...LOCK_FIELDS]));

  return {
    drug,
    changedFields,
    writeFields,
    instruction,
    mode,
    emptyFields,
    meta: { model, apiSurface: generation.apiSurface },
  };
}

module.exports = {
  correctClinicalDrugFromFields,
  resolveCorrectionInstruction,
  getEmptyCompletableFields,
  diffChangedFields,
  pickCurrentDrug,
  LOCK_FIELDS,
};
