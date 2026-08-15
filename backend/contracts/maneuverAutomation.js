// Contrato da automação de manobras de exame físico. Espelha
// contracts/clinicalDrugAutomation.js: (1) monta o JSON Schema strict para
// Structured Outputs; (2) normaliza a saída; (3) aplica a TRAVA de revisão
// humana — a IA nunca marca a manobra como revisada nem publicada.
//
// Como no bulário, as chaves do modelo (snake_case) NÃO são os rótulos das
// propriedades no Notion, então o mapa FIELD_TO_NOTION é explícito.

const { stripAccents } = require('../utils/stringSimilarity');

// Estado que a trava injeta em toda saída automática (a IA nunca define isto).
const STATUS_AUTOMACAO_GERADO = 'gerado — aguardando revisão';
const STATUS_AUTOMACAO_CORRIGIDO = 'corrigido — aguardando revisão';
const STATUS_AUTOMACAO_ERRO = 'erro na automação';

const PENDING_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
]);

// Conteúdo de IA pronto para revisão: publicável no sync MANUAL (o humano
// clicou = decisão de publicar), mas RETIDO no webhook (automático).
const READY_FOR_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
]);

// Estados que NUNCA publicam (stub sem conteúdo, pendente de correção ou erro).
const NOT_READY_STATUSES = new Set([
  'a gerar',
  'a corrigir',
  STATUS_AUTOMACAO_ERRO,
]);

function shouldHoldFromSync(automationStatus, { bypassReviewGate = false } = {}) {
  const status = String(automationStatus || '').trim();

  if (!status) {
    return false; // fora do fluxo de automação -> sincroniza normalmente
  }

  if (NOT_READY_STATUSES.has(status)) {
    return true; // nunca publica (stub/pendente/erro)
  }

  if (READY_FOR_REVIEW_STATUSES.has(status)) {
    return !bypassReviewGate; // manual publica; webhook segura
  }

  return false;
}

// Chave do modelo (snake_case) -> rótulo da propriedade no Notion.
const FIELD_TO_NOTION = {
  name: 'Name',
  slug: 'Slug',
  aliases: 'Aliases',
  category: 'Category',
  related_conditions: 'Related conditions',
  when_to_perform: 'When to perform',
  how_to_perform: 'How to perform',
  positive_finding: 'Positive finding',
  negative_finding: 'Negative finding',
  clinical_utility: 'Clinical utility',
  source: 'Source',
  // controle (não gerados pelo modelo):
  automation_status: 'Status Automação',
  correction_instruction: 'Instrução de correção',
  review_status: 'Review status',
};

const NOTION_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_NOTION).map(([field, notionName]) => [notionName, field]),
);

// Precisa bater com as opções do select "Category" no Notion e com o que o
// frontend exibe como região.
const CANONICAL_CATEGORIES = [
  'Abdominal',
  'Ortopédico',
  'Neurológico',
  'Cardiovascular',
  'Respiratório',
  'Geniturinário',
  'Cabeça e pescoço',
  'Outro',
];

const SHORT_TEXT_FIELDS = ['name', 'aliases', 'related_conditions', 'source'];
const LONG_TEXT_FIELDS = [
  'when_to_perform',
  'how_to_perform',
  'positive_finding',
  'negative_finding',
  'clinical_utility',
];
const SELECT_ENUM_FIELDS = ['category'];

// Campos que o MODELO gera. slug é derivado do nome; os campos de controle
// ficam por conta da trava/humano.
const MODEL_GENERATED_FIELDS = [
  ...SHORT_TEXT_FIELDS,
  ...LONG_TEXT_FIELDS,
  ...SELECT_ENUM_FIELDS,
];

// Campos considerados ao completar UMA página marcada "a corrigir".
const COMPLETABLE_FIELDS = [
  'aliases',
  'category',
  'related_conditions',
  'when_to_perform',
  'how_to_perform',
  'positive_finding',
  'negative_finding',
  'clinical_utility',
  'source',
];

// Na fila em lote, `aliases` e `source` ficam de fora: nem toda manobra tem
// sinônimo consagrado, e exigir fonte enfileiraria o catálogo inteiro.
const QUEUEABLE_FIELDS = COMPLETABLE_FIELDS.filter(
  (field) => field !== 'aliases' && field !== 'source',
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

// `options` = { category: [...] } com as opções vivas do Notion já
// intersectadas com o conjunto canônico.
function buildManeuverSchema(options = {}) {
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

// Normaliza a saída do modelo. NÃO aplica a trava.
function normalizeManeuver(raw = {}, options = {}) {
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

// TRAVA DE REVISÃO HUMANA. Injeta o status de automação e força o rótulo de
// revisão clínica para pendente: conteúdo gerado por IA nunca chega ao médico
// sem alguém validar (o backend esconde 'Não usar sem validação', e o sync
// respeita o status de automação para não publicar).
function applyManeuverLock(maneuver = {}, { statusAutomacao = STATUS_AUTOMACAO_GERADO } = {}) {
  return {
    ...maneuver,
    automation_status: statusAutomacao,
    review_status: 'Revisão pendente',
  };
}

function finalizeManeuver(raw = {}, options = {}, lockOptions = {}) {
  return applyManeuverLock(normalizeManeuver(raw, options), lockOptions);
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
  applyManeuverLock,
  buildManeuverSchema,
  finalizeManeuver,
  isFieldEmpty,
  normalizeManeuver,
  normalizeSlug,
  resolveCategoryOptions,
  shouldHoldFromSync,
};
