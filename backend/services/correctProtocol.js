// Correção pontual de um protocolo existente (status_automacao = "a corrigir").
//
// NÃO regenera o protocolo inteiro: lê o conteúdo atual da página + a instrução
// (instrucao_correcao / observacao_editorial), pede ao modelo o protocolo com
// SOMENTE a correção aplicada, e faz um DIFF no código — apenas os campos que
// realmente mudaram são escritos (mais os campos de trava, sempre reaplicados).

const OpenAI = require('openai');
const {
  buildProtocolSchema,
  normalizeProtocol,
  applyAutomationLock,
  STATUS_AUTOMACAO_CORRIGIDO,
  MODEL_GENERATED_FIELDS,
  MULTI_SELECT_ENUM_FIELDS,
} = require('../contracts/protocolAutomation');
const {
  buildCorrectionInstructions,
  buildCorrectionInput,
} = require('../prompts/protocolPrompt');
const {
  getProtocolEnumOptions,
  isNotionProtocolsConfigured,
} = require('./notionProtocolSchema');
const { createStructuredProtocolResponse, resolveModel } = require('./generateProtocol');

// Campos de trava sempre reescritos numa correção automática (reset da revisão).
const LOCK_FIELDS = ['status_revisao', 'pronto_para_supabase', 'revisor', 'status_automacao'];

function pickCurrentProtocol(fields) {
  const current = {};

  for (const key of MODEL_GENERATED_FIELDS) {
    const value = fields[key];
    if (MULTI_SELECT_ENUM_FIELDS.includes(key) || key === 'tags') {
      current[key] = Array.isArray(value) ? value : [];
    } else {
      current[key] = value == null ? '' : String(value);
    }
  }

  return current;
}

function valuesEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(Array.isArray(a) ? a : []) === JSON.stringify(Array.isArray(b) ? b : []);
  }
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

// Compara os campos gerados e retorna os que realmente mudaram.
function diffChangedFields(currentNorm, nextNorm) {
  return MODEL_GENERATED_FIELDS.filter((key) => !valuesEqual(currentNorm[key], nextNorm[key]));
}

function getCorrectionInstruction(fields) {
  return String(fields.instrucao_correcao || '').trim() ||
    String(fields.observacao_editorial || '').trim();
}

/**
 * Gera a correção de um protocolo a partir dos campos atuais lidos da página.
 * Retorna { protocol (travado, status corrigido), changedFields, writeFields,
 * instruction, meta }. NÃO escreve no Notion (quem chama decide).
 */
async function correctProtocolFromFields(fields) {
  const instruction = getCorrectionInstruction(fields);

  if (!instruction) {
    const error = new Error('Sem instrução de correção (preencha instrucao_correcao ou observacao_editorial).');
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('A integração com IA não está configurada.');
    error.statusCode = 503;
    throw error;
  }

  let enumOptions = { especialidade: [], contexto: [], tipo_protocolo: [], nivel_risco: [] };
  if (isNotionProtocolsConfigured()) {
    try {
      enumOptions = (await getProtocolEnumOptions()).options;
    } catch (_error) {
      // segue com enums livres
    }
  }

  const currentProtocol = pickCurrentProtocol(fields);
  const schema = buildProtocolSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildCorrectionInstructions(),
    input: buildCorrectionInput({ currentProtocol, instruction, enumOptions }),
    schema,
  });

  // Normaliza os dois lados para comparar só mudanças reais de conteúdo.
  const currentNorm = normalizeProtocol(currentProtocol, enumOptions);
  const nextNorm = normalizeProtocol(generation.raw, enumOptions);
  const changedFields = diffChangedFields(currentNorm, nextNorm);

  const protocol = applyAutomationLock(nextNorm, { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO });
  // Escreve os campos que mudaram + sempre as travas (reset da revisão).
  const writeFields = Array.from(new Set([...changedFields, ...LOCK_FIELDS]));

  return {
    protocol,
    changedFields,
    writeFields,
    instruction,
    meta: { model, apiSurface: generation.apiSurface },
  };
}

module.exports = {
  correctProtocolFromFields,
  diffChangedFields,
  pickCurrentProtocol,
  LOCK_FIELDS,
};
