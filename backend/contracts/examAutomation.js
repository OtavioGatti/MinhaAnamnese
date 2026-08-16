// Contrato da automação de exames complementares. Espelha
// contracts/maneuverAutomation.js: (1) monta o JSON Schema strict; (2) normaliza
// a saída; (3) aplica a TRAVA de revisão humana.
//
// Faixa de referência é o dado mais perigoso deste catálogo: varia por
// laboratório e método. O prompt trata disso; aqui a trava garante que nada
// gerado publique sem revisão.

const { stripAccents } = require('../utils/stringSimilarity');

const STATUS_AUTOMACAO_GERADO = 'gerado — aguardando revisão';
const STATUS_AUTOMACAO_CORRIGIDO = 'corrigido — aguardando revisão';
const STATUS_AUTOMACAO_ERRO = 'erro na automação';

const PENDING_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
]);

const READY_FOR_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
]);

const NOT_READY_STATUSES = new Set([
  'a gerar',
  'a corrigir',
  STATUS_AUTOMACAO_ERRO,
]);

function shouldHoldFromSync(automationStatus, { bypassReviewGate = false } = {}) {
  const status = String(automationStatus || '').trim();

  if (!status) {
    return false;
  }

  if (NOT_READY_STATUSES.has(status)) {
    return true;
  }

  if (READY_FOR_REVIEW_STATUSES.has(status)) {
    return !bypassReviewGate;
  }

  return false;
}

const FIELD_TO_NOTION = {
  name: 'Name',
  slug: 'Slug',
  aliases: 'Aliases',
  category: 'Category',
  related_conditions: 'Related conditions',
  when_to_request: 'When to request',
  preparation: 'Preparation',
  how_to_interpret: 'How to interpret',
  limitations: 'Limitations',
  source: 'Source',
  // controle (não gerados pelo modelo):
  automation_status: 'Status Automação',
  correction_instruction: 'Instrução de correção',
  review_status: 'Review status',
};

const NOTION_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_NOTION).map(([field, notionName]) => [notionName, field]),
);

const CANONICAL_CATEGORIES = ['Laboratorial', 'Imagem', 'Funcional', 'Outro'];

const SHORT_TEXT_FIELDS = ['name', 'aliases', 'related_conditions', 'source'];
const LONG_TEXT_FIELDS = [
  'when_to_request',
  'preparation',
  'how_to_interpret',
  'limitations',
];
const SELECT_ENUM_FIELDS = ['category'];

const MODEL_GENERATED_FIELDS = [
  ...SHORT_TEXT_FIELDS,
  ...LONG_TEXT_FIELDS,
  ...SELECT_ENUM_FIELDS,
];

const COMPLETABLE_FIELDS = [
  'aliases',
  'category',
  'related_conditions',
  'when_to_request',
  'preparation',
  'how_to_interpret',
  'limitations',
  'source',
];

// Na fila em lote, `aliases`, `preparation` e `source` ficam de fora: nem todo
// exame tem sinônimo ou exige preparo, e exigir fonte enfileiraria tudo.
const QUEUEABLE_FIELDS = COMPLETABLE_FIELDS.filter(
  (field) => !['aliases', 'preparation', 'source'].includes(field),
);

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function selectProperty(options) {
  if (Array.isArray(options) && options.length > 0) {
    return { type: 'string', enum: options };
  }

  return { type: 'string' };
}

function buildExamSchema(options = {}) {
  const properties = {};

  for (const field of SHORT_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }

  for (const field of LONG_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }

  for (const field of SELECT_ENUM_FIELDS) {
    properties[field] = selectProperty(options[field]);
  }

  return {
    type: 'object',
    additionalProperties: false,
    required: [...MODEL_GENERATED_FIELDS],
    properties,
  };
}

function resolveCategoryOptions(liveOptions) {
  const live = new Set(Array.isArray(liveOptions) ? liveOptions : []);
  const allowed = CANONICAL_CATEGORIES.filter((value) => live.has(value));
  return allowed.length > 0 ? allowed : CANONICAL_CATEGORIES;
}

function normalizeExam(raw = {}, options = {}) {
  const out = {};

  for (const field of SHORT_TEXT_FIELDS) {
    out[field] = normalizeText(raw[field]);
  }

  for (const field of LONG_TEXT_FIELDS) {
    out[field] = normalizeLongText(raw[field]);
  }

  const allowedCategories = new Set(
    Array.isArray(options.category) && options.category.length > 0
      ? options.category
      : CANONICAL_CATEGORIES,
  );
  const category = normalizeText(raw.category);
  out.category = allowedCategories.has(category) ? category : '';

  out.slug = normalizeSlug(raw.slug || out.name);

  return out;
}

// TRAVA DE REVISÃO HUMANA. Mesma dupla das manobras: status de automação +
// rótulo de revisão pendente, que o backend usa para esconder do médico.
function applyExamLock(exam = {}, { statusAutomacao = STATUS_AUTOMACAO_GERADO } = {}) {
  return {
    ...exam,
    automation_status: statusAutomacao,
    review_status: 'Revisão pendente',
  };
}

function finalizeExam(raw = {}, options = {}, lockOptions = {}) {
  return applyExamLock(normalizeExam(raw, options), lockOptions);
}

function isFieldEmpty(field, value) {
  return String(value == null ? '' : value).trim() === '';
}

module.exports = {
  CANONICAL_CATEGORIES,
  COMPLETABLE_FIELDS,
  FIELD_TO_NOTION,
  LONG_TEXT_FIELDS,
  MODEL_GENERATED_FIELDS,
  NOTION_TO_FIELD,
  NOT_READY_STATUSES,
  PENDING_REVIEW_STATUSES,
  QUEUEABLE_FIELDS,
  READY_FOR_REVIEW_STATUSES,
  SELECT_ENUM_FIELDS,
  SHORT_TEXT_FIELDS,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  STATUS_AUTOMACAO_GERADO,
  applyExamLock,
  buildExamSchema,
  finalizeExam,
  isFieldEmpty,
  normalizeExam,
  normalizeSlug,
  resolveCategoryOptions,
  shouldHoldFromSync,
};
