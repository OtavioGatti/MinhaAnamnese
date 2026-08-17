// Geração de ferramenta clínica (score/calculadora) via OpenAI Structured
// Outputs. Reusa o caller dos protocolos e aplica SEMPRE a trava de revisão.
// NÃO escreve no Notion.
//
// Diferente dos outros geradores, aqui a saída passa por um PORTÃO DE
// VALIDAÇÃO real (validateGeneratedTool) antes de ser considerada conteúdo: o
// mesmo validador que o catálogo usa para decidir se uma ferramenta pode
// aparecer para o médico. O que não valida volta com os erros, e o runner
// marca a página como "erro na automação" em vez de escrever lógica quebrada.

const OpenAI = require('openai');
const {
  buildClinicalToolSchema,
  finalizeClinicalTool,
  validateGeneratedTool,
} = require('../contracts/clinicalToolAutomation');
const {
  buildClinicalToolInput,
  buildClinicalToolInstructions,
} = require('../prompts/clinicalToolPrompt');
const {
  getClinicalToolEnumOptions,
  isNotionClinicalToolsConfigured,
} = require('./notionClinicalToolSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');

const DEFAULT_MODEL = 'gpt-4.1';

function resolveClinicalToolModel() {
  return String(
    process.env.CLINICAL_TOOL_MODEL || process.env.PROTOCOL_MODEL || DEFAULT_MODEL,
  ).trim() || DEFAULT_MODEL;
}

async function loadEnumOptions() {
  let enumOptions = { category: [], subcategory: [] };
  let meta = { source: 'unavailable' };

  if (isNotionClinicalToolsConfigured()) {
    try {
      const result = await getClinicalToolEnumOptions();
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
 * Gera uma ferramenta clínica a partir do nome. Retorna
 * { tool, validation, enumOptions, meta }. A ferramenta JÁ vem com a trava de
 * revisão. `validation.valid === false` significa que a saída NÃO deve virar
 * conteúdo. NÃO escreve no Notion.
 */
async function generateClinicalTool({ name } = {}) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    const error = new Error('Informe o nome da ferramenta a ser gerada.');
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
  const schema = buildClinicalToolSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveClinicalToolModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildClinicalToolInstructions(),
    input: buildClinicalToolInput({ name: cleanName, enumOptions }),
    schema,
  });

  const raw = { ...generation.raw };

  if (!String(raw.title || '').trim()) {
    raw.title = cleanName;
  }

  const tool = finalizeClinicalTool(raw, enumOptions);
  const validation = validateGeneratedTool(tool);

  return {
    tool,
    validation,
    enumOptions,
    meta: { model, apiSurface: generation.apiSurface, enumOptions: enumMeta },
  };
}

module.exports = {
  generateClinicalTool,
  resolveClinicalToolModel,
};
