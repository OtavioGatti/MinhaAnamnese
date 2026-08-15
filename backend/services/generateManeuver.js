// Geração de manobra de exame físico via OpenAI Structured Outputs. Reusa o
// caller de Structured Outputs dos protocolos (createStructuredProtocolResponse)
// e aplica SEMPRE a trava de revisão humana antes de devolver.
// NÃO escreve no Notion.

const OpenAI = require('openai');
const {
  buildManeuverSchema,
  finalizeManeuver,
} = require('../contracts/maneuverAutomation');
const {
  buildManeuverInput,
  buildManeuverInstructions,
} = require('../prompts/maneuverPrompt');
const {
  getManeuverEnumOptions,
  isNotionManeuversConfigured,
} = require('./notionManeuverSchema');
const { createStructuredProtocolResponse } = require('./generateProtocol');

const DEFAULT_MODEL = 'gpt-4.1';

function resolveManeuverModel() {
  return String(process.env.MANEUVER_MODEL || process.env.PROTOCOL_MODEL || DEFAULT_MODEL).trim()
    || DEFAULT_MODEL;
}

async function loadEnumOptions() {
  let enumOptions = { category: [] };
  let meta = { source: 'unavailable' };

  if (isNotionManeuversConfigured()) {
    try {
      const result = await getManeuverEnumOptions();
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
 * Gera uma manobra a partir do nome. Retorna { maneuver, enumOptions, meta } —
 * a manobra JÁ vem com a trava de revisão. NÃO escreve no Notion.
 */
async function generateManeuver({ name } = {}) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    const error = new Error('Informe o nome da manobra a ser gerada.');
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
  const schema = buildManeuverSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const model = resolveManeuverModel();

  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions: buildManeuverInstructions(),
    input: buildManeuverInput({ name: cleanName, enumOptions }),
    schema,
  });

  // Preserva o nome pedido caso o modelo não devolva (ex.: não reconheceu a
  // manobra e devolveu tudo vazio, como o prompt manda fazer).
  const raw = { ...generation.raw };

  if (!String(raw.name || '').trim()) {
    raw.name = cleanName;
  }

  const maneuver = finalizeManeuver(raw, enumOptions);

  return {
    maneuver,
    enumOptions,
    meta: { model, apiSurface: generation.apiSurface, enumOptions: enumMeta },
  };
}

module.exports = {
  generateManeuver,
  resolveManeuverModel,
};
