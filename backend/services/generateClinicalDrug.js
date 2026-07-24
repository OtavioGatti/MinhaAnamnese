// Geração de bula (medicamento) via OpenAI Structured Outputs. Reusa o caller
// de Structured Outputs dos protocolos (createStructuredProtocolResponse) e
// aplica SEMPRE a trava de revisão humana antes de devolver. NÃO escreve no Notion.

const OpenAI = require('openai');
const {
  buildClinicalDrugSchema,
  finalizeClinicalDrug,
} = require('../contracts/clinicalDrugAutomation');
const {
  buildDrugInstructions,
  buildDrugInput,
} = require('../prompts/clinicalDrugPrompt');
const {
  getClinicalDrugEnumOptions,
  isNotionClinicalDrugsConfigured,
} = require('./notionClinicalDrugSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');

const DEFAULT_MODEL = 'gpt-4.1';

function resolveDrugModel() {
  return String(process.env.CLINICAL_DRUG_MODEL || process.env.PROTOCOL_MODEL || DEFAULT_MODEL).trim()
    || DEFAULT_MODEL;
}

async function loadEnumOptions() {
  let enumOptions = { pregnancy_risk: [] };
  let meta = { source: 'unavailable' };

  if (isNotionClinicalDrugsConfigured()) {
    try {
      const result = await getClinicalDrugEnumOptions();
      enumOptions = result.options;
      meta = { source: 'notion', ...result.meta };
    } catch (error) {
      meta = { source: 'error', error: String(error?.responseBody || error?.message || 'unknown').slice(0, 300) };
    }
  }

  return { enumOptions, meta };
}

/**
 * Gera uma bula a partir do nome do princípio ativo. Retorna { drug, enumOptions,
 * meta } — o drug JÁ vem com a trava de revisão. NÃO escreve no Notion.
 */
async function generateClinicalDrug({ activeIngredient } = {}) {
  const cleanName = String(activeIngredient || '').trim();

  if (!cleanName) {
    const error = new Error('Informe o princípio ativo a ser gerado.');
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
  const schema = buildClinicalDrugSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveDrugModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildDrugInstructions(),
    input: buildDrugInput({ activeIngredient: cleanName, enumOptions }),
    schema,
  });

  // Preserva o nome pedido caso o modelo não devolva o princípio ativo.
  const raw = { ...generation.raw };
  if (!String(raw.active_ingredient || '').trim()) {
    raw.active_ingredient = cleanName;
  }

  const drug = finalizeClinicalDrug(raw, enumOptions);

  return {
    drug,
    enumOptions,
    meta: { model, apiSurface: generation.apiSurface, enumOptions: enumMeta },
  };
}

module.exports = {
  generateClinicalDrug,
  resolveDrugModel,
};
