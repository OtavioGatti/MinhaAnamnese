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

const MODEL = 'gpt-4o-mini';
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
    const response = await openai.responses.create({
      model: MODEL,
      instructions: INSTRUCTIONS,
      input: key,
      text: {
        format: {
          type: 'json_schema',
          name: 'cid10_query_expansion',
          strict: true,
          schema: EXPANSION_SCHEMA,
        },
      },
      max_output_tokens: 200,
      store: false,
    });

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
  sanitizeTerms,
};
