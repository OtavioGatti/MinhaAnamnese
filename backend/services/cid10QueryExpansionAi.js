// Último recurso da busca de CID-10: quando nem o texto literal nem a parecença
// por trigrama nem o dicionário de sinônimos acharam nada, pede à IA outras
// formas de nomear a mesma condição e busca de novo com elas.
//
// LIMITE DE SEGURANÇA: a IA devolve APENAS termos em português, nunca um código
// CID. Quem escolhe o código continua sendo a pessoa, e todo código exibido sai
// da tabela oficial do DATASUS — o mesmo contrato descrito no topo de
// services/cid10.js. Por isso a saída é filtrada: qualquer coisa com cara de
// código é descartada antes de virar busca.

const OpenAI = require('openai');
const { normalizeForMatch } = require('../utils/stringSimilarity');

const { buildChatModelParams, resolveModelChoice } = require('../utils/openaiModels');

// gpt-5.6-luna desde 15/10/2026 (gpt-4o-mini sai em 14/01/2027): 9 de 10 buscas
// leigas acharam o CID certo, como o 4o-mini, com termos mais limpos.
// CID10_EXPANSION_MODEL troca pelo Render.
const DEFAULT_MODEL = 'gpt-5.6-luna';

function resolveExpansionModel() {
  return resolveModelChoice({ envValue: process.env.CID10_EXPANSION_MODEL, fallback: DEFAULT_MODEL });
}
const MAX_TERMS = 4;
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_LIMIT = 500;

// Termo que parece código CID ("E78", "E78.5", "e 78") não pode virar busca:
// seria a IA escolhendo o código por vias transversas.
const CODE_LIKE = /\d/;

const EXPANSION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['termos'],
  properties: {
    termos: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

const INSTRUCTIONS = [
  'Você ajuda a encontrar códigos CID-10 na tabela oficial do DATASUS (português do Brasil).',
  'Receberá um termo que um médico digitou e que não encontrou resultado.',
  'Responda com outras formas de nomear a MESMA condição, priorizando a terminologia',
  'técnica que a classificação oficial costuma usar.',
  '',
  'Regras:',
  `- No máximo ${MAX_TERMS} termos, do mais provável para o menos provável.`,
  '- NUNCA inclua código CID (nem "E78", nem "E78.5", nem número algum).',
  '- Apenas nomes de condições em português, sem explicação e sem pontuação extra.',
  '- Se o termo não for uma condição de saúde, devolva lista vazia.',
].join('\n');

const cache = new Map();

function isAiExpansionEnabled() {
  return String(process.env.CID10_AI_EXPANSION_ENABLED || 'true').toLowerCase() !== 'false';
}

function readFromCache(key) {
  return cache.has(key) ? cache.get(key) : null;
}

function writeToCache(key, terms) {
  if (cache.size >= CACHE_LIMIT) {
    cache.clear();
  }

  cache.set(key, terms);
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

function sanitizeTerms(rawTerms, originalKey) {
  const seen = new Set([originalKey]);
  const terms = [];

  for (const raw of Array.isArray(rawTerms) ? rawTerms : []) {
    const normalized = normalizeForMatch(raw);

    if (!normalized || normalized.length < 3 || CODE_LIKE.test(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(normalized);

    if (terms.length >= MAX_TERMS) {
      break;
    }
  }

  return terms;
}

/**
 * Termos alternativos para uma busca que não achou nada. Sempre best-effort:
 * sem chave de API, com a flag desligada, ou em qualquer erro/timeout da IA,
 * devolve [] e a busca segue com o que já tinha.
 */
async function expandCid10QueryWithAi(query) {
  const key = normalizeForMatch(query);

  if (!key || !isAiExpansionEnabled()) {
    return [];
  }

  const cached = readFromCache(key);

  if (cached) {
    return cached;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const openai = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
    const model = resolveExpansionModel();
    // Chat Completions, não Responses: a chave de produção não tem o escopo
    // api.responses.write, e com Responses esta expansão falhava sempre, em
    // silêncio (visto em 15/10/2026).
    const completion = await openai.chat.completions.create({
      ...buildChatModelParams(model, { maxTokens: 200 }),
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: key },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'cid10_query_expansion', strict: true, schema: EXPANSION_SCHEMA },
      },
      store: false,
    });
    const response = { output_text: completion?.choices?.[0]?.message?.content || '' };

    const responseText = extractResponseText(response).trim();

    if (!responseText) {
      return [];
    }

    const terms = sanitizeTerms(JSON.parse(responseText)?.termos, key);
    writeToCache(key, terms);

    return terms;
  } catch (error) {
    console.warn('cid10: expansão por IA indisponível', error?.message || error);
    return [];
  }
}

module.exports = {
  MAX_TERMS,
  clearCid10AiExpansionCache: () => cache.clear(),
  expandCid10QueryWithAi,
  isAiExpansionEnabled,
  resolveExpansionModel,
  sanitizeTerms,
};
