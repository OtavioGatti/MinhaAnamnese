const OpenAI = require('openai');
const { normalizeCustomTemplateEnrichment } = require('../contracts/customTemplateEnrichment');

const DEFAULT_MODEL = 'gpt-4o-mini';
const ENRICHMENT_TIMEOUT_MS = 20000;
const DEBUG_TEMPLATES = process.env.DEBUG_TEMPLATES === 'true';

function logTemplateError(message, context = {}) {
  if (!DEBUG_TEMPLATES) {
    return;
  }

  console.error('templates:', message, context);
}

function resolveEnrichmentModel() {
  return String(process.env.TEMPLATE_ENRICHMENT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function isEnrichmentEnabled() {
  return (
    String(process.env.TEMPLATE_ENRICHMENT_ENABLED || 'true').toLowerCase() !== 'false' &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

const ENRICHMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    severitySignals: {
      type: 'array',
      items: { type: 'string' },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          priority: { type: 'string', enum: ['essential', 'important', 'contextual', 'optional'] },
          aliases: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { type: 'string' } },
          guidance: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'priority', 'aliases', 'evidence', 'guidance'],
      },
    },
  },
  required: ['severitySignals', 'sections'],
};

function buildInstructions() {
  return [
    'Você ajuda a estruturar templates de anamnese clínica em português do Brasil.',
    'Para CADA seção informada (use exatamente os mesmos rótulos, sem inventar seções):',
    '- priority: essential, important, contextual ou optional, conforme o peso clínico da seção.',
    '- aliases: sinônimos e abreviações reais como o médico escreveria o título da seção.',
    '- evidence: termos/palavras que indicam que a seção foi de fato preenchida no texto (ex.: para queixa: dor, febre, tosse; para HDA: "há", "desde", "início", "piora"). Termos clínicos concretos, não o próprio título.',
    '- guidance: 1 a 4 orientações objetivas do que pertence a essa seção ao organizar a anamnese. Nunca autorize inventar dados ausentes.',
    'severitySignals: sinais de gravidade relevantes para esta categoria clínica.',
    'Seja clínico, conciso e específico. Não repita o rótulo como evidência.',
  ].join('\n');
}

function buildInput({ name, categoryLabel, sections }) {
  return JSON.stringify({
    templateName: name,
    clinicalCategory: categoryLabel,
    sections,
  });
}

function parseCompletion(completion) {
  const content = completion?.choices?.[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (_error) {
    return null;
  }
}

// Enriquece um template custom com metadados por seção via IA. Best-effort:
// qualquer falha (desligado, sem chave, timeout, parse) retorna null e o
// template segue com a herança por similaridade (A).
async function enrichCustomTemplate({ name, categoryLabel, sections }) {
  if (!isEnrichmentEnabled() || !Array.isArray(sections) || sections.length < 2) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create(
      {
        model: resolveEnrichmentModel(),
        messages: [
          { role: 'system', content: buildInstructions() },
          { role: 'user', content: buildInput({ name, categoryLabel, sections }) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'custom_template_enrichment',
            strict: true,
            schema: ENRICHMENT_SCHEMA,
          },
        },
        max_tokens: 1600,
        temperature: 0.2,
        store: false,
      },
      { signal: controller.signal },
    );

    return normalizeCustomTemplateEnrichment(parseCompletion(completion), sections);
  } catch (error) {
    logTemplateError('failed to enrich custom template', {
      message: error?.message || 'unknown_error',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  enrichCustomTemplate,
  isEnrichmentEnabled,
};
