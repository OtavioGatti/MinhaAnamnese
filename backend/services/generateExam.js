// Geração de exame complementar via OpenAI Structured Outputs. Reusa o caller
// dos protocolos e aplica SEMPRE a trava de revisão humana. NÃO escreve no Notion.

const OpenAI = require('openai');
const {
  buildExamSchema,
  finalizeExam,
} = require('../contracts/examAutomation');
const {
  buildExamInput,
  buildExamInstructions,
} = require('../prompts/examPrompt');
const {
  getExamEnumOptions,
  isNotionExamsConfigured,
} = require('./notionExamSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');

// gpt-6-luna desde 15/10/2026: o gpt-4.1 sai em 14/01/2027. Na comparação (bulário e
// exames) preencheu todos os campos, com posologia igual ou mais completa, a
// ~7% do custo. PROTOCOL_MODEL (ou a variável do gerador) volta atrás.
const DEFAULT_MODEL = 'gpt-6-luna';

function resolveExamModel() {
  return String(process.env.EXAM_MODEL || process.env.PROTOCOL_MODEL || DEFAULT_MODEL).trim()
    || DEFAULT_MODEL;
}

async function loadEnumOptions() {
  let enumOptions = { category: [] };
  let meta = { source: 'unavailable' };

  if (isNotionExamsConfigured()) {
    try {
      const result = await getExamEnumOptions();
      enumOptions = result.options;
      meta = { source: 'notion', ...result.meta };
    } catch (error) {
      meta = {
        source: 'error',
        error: String(error?.responseBody || error?.message || 'unknown').slice(0, 300),
      };
    }
  }

  return { enumOptions, meta };
}

/**
 * Gera um exame a partir do nome. Retorna { exam, enumOptions, meta } — o exame
 * JÁ vem com a trava de revisão. NÃO escreve no Notion.
 */
async function generateExam({ name } = {}) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    const error = new Error('Informe o nome do exame a ser gerado.');
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('A integração com IA não está configurada.');
    error.statusCode = 503;
    throw error;
  }

  const { enumOptions, meta: enumMeta } = await loadEnumOptions();
  const schema = buildExamSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveExamModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildExamInstructions(),
    input: buildExamInput({ name: cleanName, enumOptions }),
    schema,
  });

  const raw = { ...generation.raw };

  if (!String(raw.name || '').trim()) {
    raw.name = cleanName;
  }

  const exam = finalizeExam(raw, enumOptions);

  return {
    exam,
    enumOptions,
    meta: { model, apiSurface: generation.apiSurface, enumOptions: enumMeta },
  };
}

module.exports = {
  generateExam,
  resolveExamModel,
};
