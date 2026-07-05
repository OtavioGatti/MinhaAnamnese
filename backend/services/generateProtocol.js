// Geração de protocolos de prescrição via OpenAI Structured Outputs.
//
// Reusa a plumbing já provada em generateDiagnosticHypotheses.js: SDK openai,
// Responses API com text.format.json_schema strict e fallback para
// chat.completions. A saída passa SEMPRE pela trava de revisão humana
// (finalizeAutomationProtocol) — nunca sai pronta/publicada de um fluxo de IA.

const OpenAI = require('openai');
const {
  buildProtocolSchema,
  finalizeAutomationProtocol,
  findNestedPrescriptionWarnings,
} = require('../contracts/protocolAutomation');
const {
  buildProtocolInstructions,
  buildProtocolInput,
} = require('../prompts/protocolPrompt');
const {
  getProtocolEnumOptions,
  isNotionProtocolsConfigured,
} = require('./notionProtocolSchema');

const DEFAULT_MODEL = 'gpt-4.1';
const SCHEMA_NAME = 'protocolo_prescricao';
const SAFETY_IDENTIFIER = 'minha-anamnese:protocol-automation';
const MAX_OUTPUT_TOKENS = 8000;

function resolveModel() {
  return String(process.env.PROTOCOL_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
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

function parseModelJson(rawText) {
  const text = String(rawText || '').trim();

  if (!text) {
    const error = new Error('A geração do protocolo não retornou conteúdo utilizável.');
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('A geração do protocolo retornou um formato inválido.');
    error.statusCode = 502;
    throw error;
  }
}

function shouldFallbackToChatCompletions(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 401 && message.includes('api.responses.write');
}

async function createStructuredProtocolResponse({ openai, model, instructions, input, schema }) {
  try {
    const response = await openai.responses.create({
      model,
      instructions,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: SCHEMA_NAME,
          strict: true,
          schema,
        },
      },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
      safety_identifier: SAFETY_IDENTIFIER,
      metadata: { feature: 'protocol_generation' },
    });

    const refusal = extractResponseRefusal(response);
    if (refusal) {
      const error = new Error(`O modelo recusou gerar o protocolo: ${refusal}`);
      error.statusCode = 422;
      throw error;
    }

    return { raw: parseModelJson(extractResponseText(response)), apiSurface: 'responses' };
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
      json_schema: { name: SCHEMA_NAME, strict: true, schema },
    },
    max_tokens: MAX_OUTPUT_TOKENS,
    store: false,
    safety_identifier: SAFETY_IDENTIFIER,
  });

  const message = completion?.choices?.[0]?.message || {};
  if (message.refusal) {
    const error = new Error(`O modelo recusou gerar o protocolo: ${message.refusal}`);
    error.statusCode = 422;
    throw error;
  }

  return { raw: parseModelJson(message.content || ''), apiSurface: 'chat_completions_fallback' };
}

/**
 * Gera um protocolo a partir de um título (e dicas opcionais). Busca as opções
 * vivas do Notion para restringir os enums; se o Notion não estiver configurado,
 * gera com enums livres e sinaliza em `enumOptionsMeta`.
 *
 * Retorna { protocol, enumOptions, meta } — o protocol JÁ vem com a trava.
 * NÃO escreve no Notion.
 */
async function generateProtocol({ titulo, especialidade, contexto, subcondicao } = {}) {
  const cleanTitulo = String(titulo || '').trim();

  if (!cleanTitulo) {
    const error = new Error('Informe o título do protocolo a ser gerado.');
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
  let enumOptionsMeta = { source: 'unavailable', missingProperties: [] };

  if (isNotionProtocolsConfigured()) {
    try {
      const result = await getProtocolEnumOptions();
      enumOptions = result.options;
      enumOptionsMeta = { source: 'notion', ...result.meta };
    } catch (error) {
      // Não falhar a geração por causa das opções — gera com enums livres.
      enumOptionsMeta = {
        source: 'error',
        error: String(error?.responseBody || error?.message || 'unknown').slice(0, 300),
      };
    }
  }

  const schema = buildProtocolSchema(enumOptions);
  const openai = new OpenAI({ apiKey });
  const instructions = buildProtocolInstructions();
  const input = buildProtocolInput({
    titulo: cleanTitulo,
    especialidade,
    contexto,
    subcondicao,
    enumOptions,
  });

  const model = resolveModel();
  const generation = await createStructuredProtocolResponse({
    openai,
    model,
    instructions,
    input,
    schema,
  });

  // Normaliza + aplica a TRAVA de revisão humana antes de devolver.
  const protocol = finalizeAutomationProtocol(generation.raw, enumOptions);
  // Sinaliza (não corrige sozinho) possível medicamento embutido na instrução
  // de outro item — precisa de revisão humana, ver findNestedPrescriptionWarnings.
  const prescriptionWarnings = findNestedPrescriptionWarnings(protocol.texto_copiavel_prescricao);

  return {
    protocol,
    enumOptions,
    meta: {
      model,
      apiSurface: generation.apiSurface,
      enumOptions: enumOptionsMeta,
      prescriptionWarnings,
    },
  };
}

module.exports = {
  generateProtocol,
  createStructuredProtocolResponse,
  resolveModel,
};
