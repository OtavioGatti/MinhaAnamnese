// Contrato da automação de ferramentas clínicas (scores e calculadoras).
//
// Diferença essencial em relação a manobras/exames: a saída aqui não é prosa,
// é LÓGICA EXECUTÁVEL — pontuação, fórmula e faixas de resultado. Texto errado
// um revisor percebe lendo; fórmula errada devolve um número plausível e
// silenciosamente errado. Por isso a geração passa pelo validador real do
// catálogo (validateClinicalToolSchema) antes de qualquer escrita, e o que não
// valida vira "erro na automação" em vez de conteúdo.
//
// LOGICA_CONDICIONAL (checklists com eixo etário) fica FORA da automação de
// propósito: o eixo tem invariantes entre applicable_from/alert_from/
// applicable_until que erram fácil e travam a publicação. Esses seguem manuais.

const { normalizeClinicalToolSchema } = require('../services/clinicalTools');

const STATUS_AUTOMACAO_GERADO = 'gerado — aguardando revisão';
const STATUS_AUTOMACAO_CORRIGIDO = 'corrigido — aguardando revisão';
const STATUS_AUTOMACAO_ERRO = 'erro na automação';

const READY_FOR_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
]);

const NOT_READY_STATUSES = new Set([
  'a gerar',
  'a corrigir',
  STATUS_AUTOMACAO_ERRO,
]);

// Mesma trava dos outros catálogos: sem bypass explícito (sync manual, feito por
// um humano), nada que a IA tocou chega ao médico.
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
  title: 'Título',
  slug: 'Slug',
  category: 'Categoria',
  subcategory: 'Subcategoria',
  description: 'Descrição',
  source_reference: 'Fonte / Referência',
  tool_type: 'Tipo Motor',
  fields_json: 'Campos',
  engine_config_json: 'Config Motor',
  result_ranges_json: 'Faixas Resultado',
  search_tags: 'Tags Busca',
  // controle (não gerados pelo modelo):
  publication_status: 'Status Publicação',
  automation_status: 'Status Automação',
  correction_instruction: 'Instrução de correção',
  validation_errors: 'Erros de validação',
};

const NOTION_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_NOTION).map(([field, notionName]) => [notionName, field]),
);

// Rótulos do Notion ("Tipo Motor") — o normalizador do catálogo já converte
// para os internos (sum_points / math_formula).
const AUTOMATABLE_ENGINE_TYPES = ['SOMA_PONTOS', 'FORMULA_MATEMATICA'];
const INPUT_TYPES = ['select', 'radio', 'number', 'checkbox'];
const ALERT_COLORS = ['green', 'yellow', 'red', 'blue', 'gray'];

// Espelha ALLOWED_FORMULA_FUNCTIONS de services/clinicalTools.js. Repetido aqui
// só para o prompt poder listar ao modelo o que é permitido.
const ALLOWED_FORMULA_FUNCTIONS = [
  'abs', 'ceil', 'exp', 'floor', 'ifelse', 'ln', 'log', 'max', 'min', 'pow', 'round', 'sqrt',
];

// Sem as opções vivas do Notion (data source não configurado), schema e
// normalização precisam cair no MESMO fallback — senão o modelo responde
// "Outro" porque o schema só oferece isso, e a normalização descarta por não
// constar da lista vazia, deixando a ferramenta sem categoria.
const CATEGORY_FALLBACK = ['Outro'];

function resolveAllowed(options, fallback = CATEGORY_FALLBACK) {
  return Array.isArray(options) && options.length > 0 ? options : fallback;
}

function selectProperty(options, fallback) {
  return { type: 'string', enum: resolveAllowed(options, fallback) };
}

// JSON Schema strict do Structured Outputs: toda propriedade precisa estar em
// `required` e `additionalProperties` sempre false. O que é "opcional" na
// prática vira string vazia ou null explícito.
function buildClinicalToolSchema(options = {}) {
  const optionSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'value', 'numeric_value', 'helper_text'],
    properties: {
      label: { type: 'string' },
      value: { type: 'string' },
      numeric_value: { type: 'number' },
      helper_text: { type: 'string' },
    },
  };

  const fieldSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label', 'input_type', 'helper_text', 'unit', 'min', 'max', 'step', 'options'],
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      input_type: { type: 'string', enum: INPUT_TYPES },
      helper_text: { type: 'string' },
      unit: { type: 'string' },
      min: { type: ['number', 'null'] },
      max: { type: ['number', 'null'] },
      step: { type: ['number', 'null'] },
      options: { type: 'array', items: optionSchema },
    },
  };

  const resultRangeSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['min', 'max', 'classification', 'alert_color', 'orientation'],
    properties: {
      min: { type: ['number', 'null'] },
      max: { type: ['number', 'null'] },
      classification: { type: 'string' },
      alert_color: { type: 'string', enum: ALERT_COLORS },
      orientation: { type: 'string' },
    },
  };

  const engineConfigSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['formula', 'precision', 'unit', 'score_label', 'result_label'],
    properties: {
      formula: { type: 'string' },
      precision: { type: 'integer' },
      unit: { type: 'string' },
      score_label: { type: 'string' },
      result_label: { type: 'string' },
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'slug',
      'category',
      'subcategory',
      'description',
      'source_reference',
      'search_tags',
      'tool_type',
      'fields',
      'engine_config',
      'result_ranges',
    ],
    properties: {
      title: { type: 'string' },
      slug: { type: 'string' },
      category: selectProperty(options.category, ['Outro']),
      subcategory: selectProperty(options.subcategory, ['Outro']),
      description: { type: 'string' },
      source_reference: { type: 'string' },
      search_tags: { type: 'string' },
      tool_type: { type: 'string', enum: AUTOMATABLE_ENGINE_TYPES },
      fields: { type: 'array', items: fieldSchema },
      engine_config: engineConfigSchema,
      result_ranges: { type: 'array', items: resultRangeSchema },
    },
  };
}

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

function pickAllowed(value, allowed, fallback) {
  const normalized = normalizeText(value);
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeGeneratedOption(option) {
  return {
    label: normalizeText(option?.label),
    value: normalizeText(option?.value),
    numeric_value: Number.isFinite(Number(option?.numeric_value)) ? Number(option.numeric_value) : 0,
    helper_text: normalizeLongText(option?.helper_text),
  };
}

function normalizeGeneratedField(field) {
  const inputType = pickAllowed(field?.input_type, INPUT_TYPES, 'select');

  return {
    id: normalizeText(field?.id),
    label: normalizeText(field?.label),
    input_type: inputType,
    helper_text: normalizeLongText(field?.helper_text),
    unit: normalizeText(field?.unit),
    min: field?.min == null ? null : Number(field.min),
    max: field?.max == null ? null : Number(field.max),
    step: field?.step == null ? null : Number(field.step),
    options: (Array.isArray(field?.options) ? field.options : []).map(normalizeGeneratedOption),
  };
}

function normalizeGeneratedResultRange(range) {
  return {
    min: range?.min == null ? null : Number(range.min),
    max: range?.max == null ? null : Number(range.max),
    classification: normalizeText(range?.classification),
    alert_color: pickAllowed(range?.alert_color, ALERT_COLORS, 'gray'),
    orientation: normalizeLongText(range?.orientation),
  };
}

function normalizeClinicalTool(raw = {}, options = {}) {
  return {
    title: normalizeText(raw.title),
    slug: normalizeText(raw.slug),
    category: pickAllowed(raw.category, resolveAllowed(options.category), ''),
    subcategory: pickAllowed(raw.subcategory, resolveAllowed(options.subcategory), ''),
    description: normalizeLongText(raw.description),
    source_reference: normalizeLongText(raw.source_reference),
    search_tags: normalizeText(raw.search_tags),
    tool_type: pickAllowed(raw.tool_type, AUTOMATABLE_ENGINE_TYPES, 'SOMA_PONTOS'),
    fields: (Array.isArray(raw.fields) ? raw.fields : []).map(normalizeGeneratedField),
    engine_config: {
      formula: normalizeText(raw.engine_config?.formula),
      precision: Number.isFinite(Number(raw.engine_config?.precision))
        ? Math.min(Math.max(Math.trunc(Number(raw.engine_config.precision)), 0), 6)
        : 0,
      unit: normalizeText(raw.engine_config?.unit),
      score_label: normalizeText(raw.engine_config?.score_label),
      result_label: normalizeText(raw.engine_config?.result_label),
    },
    result_ranges: (Array.isArray(raw.result_ranges) ? raw.result_ranges : [])
      .map(normalizeGeneratedResultRange),
  };
}

// TRAVA DE REVISÃO HUMANA. Além do status de automação, força
// publication_status='draft': uma calculadora nunca sai publicada de um fluxo
// de IA, nem por engano de quem revisa depois.
function applyToolLock(tool = {}, { statusAutomacao = STATUS_AUTOMACAO_GERADO } = {}) {
  return {
    ...tool,
    automation_status: statusAutomacao,
    publication_status: 'draft',
  };
}

// Converte o formato gerado (snake_case, como o Notion guarda) no formato de
// linha que normalizeClinicalToolSchema espera, para rodar o validador real.
function toCatalogRow(tool) {
  return {
    id: tool.slug || 'preview',
    slug: tool.slug,
    title: tool.title,
    category: tool.category,
    subcategory: tool.subcategory,
    description: tool.description,
    source_reference: tool.source_reference,
    tool_type: tool.tool_type,
    engine_config: tool.engine_config,
    fields: tool.fields,
    result_ranges: tool.result_ranges,
    status: 'draft',
  };
}

// Cobertura das faixas de resultado num score: a soma máxima possível precisa
// cair dentro de alguma faixa. Sem isso passa uma calculadora que soma 9 pontos
// mas só classifica até 6 — ela devolve "sem classificação" no pior caso, que é
// justamente o caso grave.
function findScoreCoverageErrors(tool) {
  if (tool.tool_type !== 'SOMA_PONTOS') {
    return [];
  }

  const ranges = Array.isArray(tool.result_ranges) ? tool.result_ranges : [];

  if (ranges.length === 0) {
    return ['score sem faixas de resultado'];
  }

  const fields = Array.isArray(tool.fields) ? tool.fields : [];
  const maxScore = fields.reduce((total, field) => {
    const values = (field.options || []).map((option) => Number(option.numeric_value) || 0);

    if (values.length === 0) {
      return total;
    }

    // checkbox soma todas as opções marcáveis; select/radio soma só a maior.
    return total + (field.input_type === 'checkbox'
      ? values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)
      : Math.max(...values));
  }, 0);

  const minScore = fields.reduce((total, field) => {
    const values = (field.options || []).map((option) => Number(option.numeric_value) || 0);
    return values.length === 0 ? total : total + Math.min(...values);
  }, 0);

  const covers = (score) => ranges.some((range) => {
    const min = range.min == null ? -Infinity : Number(range.min);
    const max = range.max == null ? Infinity : Number(range.max);
    return score >= min && score <= max;
  });

  const errors = [];

  if (!covers(minScore)) {
    errors.push(`faixas não cobrem a pontuação mínima possível (${minScore})`);
  }

  if (!covers(maxScore)) {
    errors.push(`faixas não cobrem a pontuação máxima possível (${maxScore})`);
  }

  return errors;
}

// Portão único da automação: só é conteúdo se passar no validador real do
// catálogo E na cobertura de faixas.
function validateGeneratedTool(tool) {
  const normalizedRow = normalizeClinicalToolSchema(toCatalogRow(tool));
  const schemaErrors = normalizedRow?.validation?.errors || ['não foi possível normalizar a ferramenta'];
  const coverageErrors = findScoreCoverageErrors(tool);
  const errors = [...schemaErrors, ...coverageErrors];

  return { valid: errors.length === 0, errors, normalized: normalizedRow };
}

function finalizeClinicalTool(raw = {}, options = {}, lockOptions = {}) {
  return applyToolLock(normalizeClinicalTool(raw, options), lockOptions);
}

module.exports = {
  ALERT_COLORS,
  ALLOWED_FORMULA_FUNCTIONS,
  AUTOMATABLE_ENGINE_TYPES,
  FIELD_TO_NOTION,
  INPUT_TYPES,
  NOTION_TO_FIELD,
  NOT_READY_STATUSES,
  READY_FOR_REVIEW_STATUSES,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  STATUS_AUTOMACAO_GERADO,
  applyToolLock,
  buildClinicalToolSchema,
  finalizeClinicalTool,
  findScoreCoverageErrors,
  normalizeClinicalTool,
  shouldHoldFromSync,
  toCatalogRow,
  validateGeneratedTool,
};
