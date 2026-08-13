const MAX_SEARCH_RESULTS = 80;
const MAX_QUERY_LENGTH = 80;

const TOOL_TYPES = new Set(['sum_points', 'math_formula', 'conditional_logic']);
const INPUT_TYPES = new Set(['select', 'radio', 'number', 'checkbox']);
const ALERT_COLORS = new Set(['green', 'yellow', 'red', 'blue', 'gray']);
const CHECKLIST_OUTCOMES = new Set(['present', 'absent', 'not_applicable']);
const CHECKLIST_LABEL_KEYS = ['present', 'alert', 'watch', 'notApplicable', 'upcoming'];
const ALLOWED_FORMULA_FUNCTIONS = new Set([
  'abs',
  'ceil',
  'exp',
  'floor',
  'ifelse',
  'ln',
  'log',
  'max',
  'min',
  'pow',
  'round',
  'sqrt',
]);

const CLINICAL_TOOL_SELECT = [
  'id',
  'slug',
  'title',
  'category',
  'subcategory',
  'description',
  'source_reference',
  'tool_type',
  'engine_config',
  'fields',
  'result_ranges',
  'status',
  'updated_at',
].join(',');

function getClinicalToolsConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isClinicalToolsStorageAvailable() {
  const { url, serviceRoleKey } = getClinicalToolsConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeKey(value) {
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeToolType(value) {
  const normalized = normalizeKey(value);

  if (normalized === 'soma_pontos' || normalized === 'score' || normalized === 'sum') {
    return 'sum_points';
  }

  if (normalized === 'formula_matematica' || normalized === 'formula' || normalized === 'calculator') {
    return 'math_formula';
  }

  if (normalized === 'logica_condicional' || normalized === 'conditional' || normalized === 'questionnaire') {
    return 'conditional_logic';
  }

  return TOOL_TYPES.has(normalized) ? normalized : 'sum_points';
}

function normalizeInputType(value) {
  const normalized = normalizeKey(value);

  if (normalized === 'numero' || normalized === 'numeric') {
    return 'number';
  }

  if (normalized === 'selecao' || normalized === 'select_option') {
    return 'select';
  }

  return INPUT_TYPES.has(normalized) ? normalized : 'select';
}

function normalizeAlertColor(value) {
  const normalized = normalizeKey(value);
  const colorMap = {
    verde: 'green',
    amarelo: 'yellow',
    vermelho: 'red',
    azul: 'blue',
    cinza: 'gray',
  };
  const color = colorMap[normalized] || normalized;

  return ALERT_COLORS.has(color) ? color : 'gray';
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeOptionalNumber(value) {
  return value == null || value === '' ? null : normalizeNumber(value, null);
}

function normalizeChecklistOutcome(value, numericValue) {
  const normalized = normalizeKey(value);
  const outcomeMap = {
    presente: 'present',
    atingido: 'present',
    aplicada: 'present',
    aplicado: 'present',
    realizado: 'present',
    sim: 'present',
    ausente: 'absent',
    nao_atingido: 'absent',
    nao_aplicada: 'absent',
    nao_aplicado: 'absent',
    nao_realizado: 'absent',
    nao: 'absent',
    nao_se_aplica: 'not_applicable',
    na: 'not_applicable',
  };
  const outcome = outcomeMap[normalized] || normalized;

  if (CHECKLIST_OUTCOMES.has(outcome)) {
    return outcome;
  }

  // Sem rótulo explícito, o valor numérico da opção decide: pontuar é "não atingido".
  return numericValue > 0 ? 'absent' : 'present';
}

function normalizeChecklistLabels(value) {
  const config = safeJsonObject(value);
  const aliases = {
    present: ['present', 'presentes', 'presente'],
    alert: ['alert', 'alerta', 'alertas'],
    watch: ['watch', 'acompanhar', 'observar'],
    notApplicable: ['notApplicable', 'not_applicable', 'nao_se_aplica'],
    upcoming: ['upcoming', 'proximos', 'proximos_itens'],
  };

  return CHECKLIST_LABEL_KEYS.reduce((accumulator, key) => {
    const label = aliases[key]
      .map((alias) => normalizeText(config[alias]))
      .find(Boolean) || '';

    return { ...accumulator, [key]: label };
  }, {});
}

function parseLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit)) {
    return 30;
  }

  return Math.min(Math.max(limit, 1), MAX_SEARCH_RESULTS);
}

function getSearchTerms(query) {
  const normalized = normalizeText(query).slice(0, MAX_QUERY_LENGTH);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s+/)
    .map((term) => term.replace(/[%,()]/g, '').trim())
    .filter((term) => term.length >= 2)
    .slice(0, 6);
}

function safeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOption(option, index) {
  const label = normalizeText(option?.label || option?.title || option?.name);

  if (!label) {
    return null;
  }

  const value = normalizeText(option?.value || option?.id || label) || `option_${index + 1}`;
  const numericValue = normalizeNumber(
    option?.numeric_value ?? option?.numericValue ?? option?.score ?? option?.points,
    0,
  );

  return {
    label,
    value: normalizeKey(value) || `option_${index + 1}`,
    numericValue,
    outcome: normalizeChecklistOutcome(option?.outcome ?? option?.resultado, numericValue),
    helperText: normalizeLongText(option?.helper_text ?? option?.helperText ?? option?.description),
  };
}

function normalizeField(field, index) {
  const label = normalizeText(field?.label || field?.title || field?.name);

  if (!label) {
    return null;
  }

  const id = normalizeKey(field?.id || label) || `field_${index + 1}`;
  const inputType = normalizeInputType(field?.input_type ?? field?.inputType ?? field?.tipo_input);
  const options = safeJsonArray(field?.options || field?.opcoes)
    .map(normalizeOption)
    .filter(Boolean);

  if ((inputType === 'select' || inputType === 'radio' || inputType === 'checkbox') && options.length === 0) {
    return null;
  }

  return {
    id,
    label,
    inputType,
    required: field?.required === false ? false : true,
    helperText: normalizeLongText(field?.helper_text ?? field?.helperText ?? field?.help ?? field?.description),
    unit: normalizeText(field?.unit || field?.unidade),
    min: field?.min == null ? null : normalizeNumber(field.min, null),
    max: field?.max == null ? null : normalizeNumber(field.max, null),
    step: field?.step == null ? null : normalizeNumber(field.step, null),
    placeholder: normalizeText(field?.placeholder),
    // Checklist condicional: em qual janela do eixo o item é perguntado e a
    // partir de qual valor a ausência vira alerta clínico.
    applicableFrom: normalizeOptionalNumber(
      field?.applicable_from ?? field?.applicableFrom ?? field?.esperado_a_partir_de ?? field?.esperado_de,
    ),
    applicableUntil: normalizeOptionalNumber(
      field?.applicable_until ?? field?.applicableUntil ?? field?.esperado_ate ?? field?.avaliar_ate,
    ),
    // Sobrescreve o texto do "esperado" quando o valor do eixo não se lê bem
    // sozinho ("ao nascer" em vez de "0 meses").
    expectedLabel: normalizeText(field?.expected_label ?? field?.expectedLabel ?? field?.rotulo_esperado),
    alertFrom: normalizeOptionalNumber(
      field?.alert_from ?? field?.alertFrom ?? field?.alerta_a_partir_de ?? field?.alerta_de,
    ),
    options,
  };
}

function normalizeResultRange(range, index) {
  const classification = normalizeText(range?.classification || range?.classificacao || range?.label || range?.title);
  const orientation = normalizeLongText(range?.orientation || range?.orientacao || range?.description);

  if (!classification && !orientation) {
    return null;
  }

  return {
    id: normalizeKey(range?.id || classification || `range_${index + 1}`) || `range_${index + 1}`,
    min: range?.min == null ? null : normalizeNumber(range.min, null),
    max: range?.max == null ? null : normalizeNumber(range.max, null),
    classification: classification || 'Resultado',
    alertColor: normalizeAlertColor(range?.alert_color || range?.alertColor || range?.cor_alerta),
    orientation,
  };
}

function normalizeEngineOutput(output, index) {
  const config = safeJsonObject(output);
  const label = normalizeText(config.label || config.title || config.name || config.result_label || config.resultLabel);
  const id = normalizeKey(config.id || label || `output_${index + 1}`) || `output_${index + 1}`;
  const requiredFields = safeJsonArray(config.required_fields || config.requiredFields || config.campos_obrigatorios)
    .map(normalizeKey)
    .filter(Boolean);
  const resultRanges = safeJsonArray(config.result_ranges || config.resultRanges || config.faixas_resultado)
    .map(normalizeResultRange)
    .filter(Boolean);

  return {
    id,
    label: label || `Resultado ${index + 1}`,
    formula: normalizeText(config.formula),
    precision: Math.min(Math.max(Number.parseInt(config.precision ?? config.decimals ?? 1, 10) || 1, 0), 6),
    unit: normalizeText(config.unit || config.unidade),
    resultLabel: normalizeText(config.result_label || config.resultLabel) || label || `Resultado ${index + 1}`,
    requiredFields,
    resultRanges,
  };
}

function normalizeEngineConfig(value) {
  const config = safeJsonObject(value);
  const outputs = safeJsonArray(config.outputs || config.resultados || config.saidas)
    .map(normalizeEngineOutput)
    .filter((output) => output.formula);

  return {
    formula: normalizeText(config.formula),
    precision: Math.min(Math.max(Number.parseInt(config.precision ?? config.decimals ?? 1, 10) || 1, 0), 6),
    unit: normalizeText(config.unit || config.unidade),
    scoreLabel: normalizeText(config.score_label || config.scoreLabel || config.label) || 'pontos',
    resultLabel: normalizeText(config.result_label || config.resultLabel) || 'Resultado',
    // Checklist condicional (opcional): campo que serve de eixo para liberar itens.
    axisFieldId: normalizeKey(config.axis_field_id || config.axisFieldId || config.campo_eixo || config.eixo),
    axisUnit: normalizeText(config.axis_unit || config.axisUnit || config.unidade_eixo),
    previewWindow: Math.max(normalizeNumber(
      config.preview_window ?? config.previewWindow ?? config.janela_previsao,
      0,
    ), 0),
    checklistLabels: normalizeChecklistLabels(
      config.checklist_labels || config.checklistLabels || config.rotulos_checklist,
    ),
    outputs,
  };
}

function validateFormula(formula, fields) {
  const normalizedFormula = normalizeText(formula);

  if (!normalizedFormula) {
    return false;
  }

  if (!/^[0-9+\-*/().,\s_a-zA-Z<>!=]+$/.test(normalizedFormula)) {
    return false;
  }

  if (/(^|[^<>=!])=([^=]|$)/.test(normalizedFormula) || /={3,}|!={2,}/.test(normalizedFormula)) {
    return false;
  }

  const fieldIds = new Set(fields.map((field) => field.id));
  const tokens = normalizedFormula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

  return tokens.every((token) => fieldIds.has(token) || ALLOWED_FORMULA_FUNCTIONS.has(token));
}

// O checklist condicional é o que impede um item fora da faixa etária de contar
// como falha. Se o eixo estiver mal configurado, a ferramenta não pode publicar.
function validateChecklistAxis(tool) {
  const errors = [];
  const fields = Array.isArray(tool.fields) ? tool.fields : [];
  const axisFieldId = tool.engineConfig?.axisFieldId;
  const hasThresholds = fields.some((field) => (
    field.applicableFrom != null || field.alertFrom != null || field.applicableUntil != null
  ));

  if (!axisFieldId) {
    if (hasThresholds) {
      errors.push('campos com faixa de aplicação exigem campo eixo no config do motor');
    }

    return errors;
  }

  const axisField = fields.find((field) => field.id === axisFieldId);

  if (!axisField) {
    errors.push('campo eixo inexistente');
    return errors;
  }

  if (axisField.inputType !== 'number' && !axisField.options.some((option) => option.numericValue > 0)) {
    errors.push('campo eixo precisa de opções com valores numéricos');
  }

  if (!hasThresholds) {
    errors.push('campo eixo configurado sem nenhum item com faixa de aplicação');
  }

  fields.forEach((field) => {
    if (field.id === axisFieldId) {
      return;
    }

    if (field.alertFrom != null && field.applicableFrom != null && field.alertFrom < field.applicableFrom) {
      errors.push(`alerta anterior à faixa de aplicação em "${field.label}"`);
    }

    if (field.applicableUntil != null && field.applicableFrom != null && field.applicableUntil < field.applicableFrom) {
      errors.push(`faixa de aplicação invertida em "${field.label}"`);
    }

    if (field.applicableUntil != null && field.alertFrom != null && field.applicableUntil < field.alertFrom) {
      errors.push(`item deixa de ser avaliado antes do alerta em "${field.label}"`);
    }
  });

  return errors;
}

function validateClinicalToolSchema(tool) {
  const errors = [];

  if (!tool.slug) {
    errors.push('slug ausente');
  }

  if (!tool.title) {
    errors.push('título ausente');
  }

  if (!TOOL_TYPES.has(tool.toolType)) {
    errors.push('tipo de motor inválido');
  }

  if (!Array.isArray(tool.fields) || tool.fields.length === 0) {
    errors.push('campos ausentes ou inválidos');
  }

  if (tool.toolType === 'math_formula') {
    const fieldIds = new Set(tool.fields.map((field) => field.id));
    const formulas = [
      tool.engineConfig.formula,
      ...safeJsonArray(tool.engineConfig.outputs).map((output) => output.formula),
    ].filter(Boolean);

    if (formulas.length === 0 || formulas.some((formula) => !validateFormula(formula, tool.fields))) {
      errors.push('fórmula ausente ou com variáveis incompatíveis');
    }

    if (safeJsonArray(tool.engineConfig.outputs).some((output) => {
      return safeJsonArray(output.requiredFields).some((fieldId) => !fieldIds.has(fieldId));
    })) {
      errors.push('required_fields com campos inexistentes');
    }
  }

  if (tool.toolType !== 'math_formula' && !tool.fields.some((field) => field.options.length > 0)) {
    errors.push('scores precisam de opções com valores numéricos');
  }

  errors.push(...validateChecklistAxis(tool));

  return {
    valid: errors.length === 0,
    errors,
  };
}

function mapClinicalToolRow(row) {
  if (!row?.slug || !row?.title) {
    return null;
  }

  const toolType = normalizeToolType(row.tool_type);
  const fields = safeJsonArray(row.fields).map(normalizeField).filter(Boolean);
  const resultRanges = safeJsonArray(row.result_ranges).map(normalizeResultRange).filter(Boolean);
  const tool = {
    id: row.id || row.slug,
    slug: normalizeSlug(row.slug),
    title: row.title,
    category: row.category || '',
    subcategory: row.subcategory || '',
    description: row.description || '',
    sourceReference: row.source_reference || '',
    toolType,
    engineConfig: normalizeEngineConfig(row.engine_config),
    fields,
    resultRanges,
    status: row.status || 'draft',
    updatedAt: row.updated_at || null,
  };
  const validation = validateClinicalToolSchema(tool);

  return {
    ...tool,
    validation,
  };
}

function isMissingClinicalToolsTable(error) {
  const message = `${error?.message || ''} ${error?.responseBody || ''}`.toLowerCase();
  return (
    message.includes('clinical_tools') &&
    (
      message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find')
    )
  );
}

async function requestClinicalTools(path, options = {}) {
  const { url, serviceRoleKey } = getClinicalToolsConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Ferramentas clínicas indisponíveis.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    const error = new Error('Não foi possível acessar as ferramentas clínicas.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    error.responseBody = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildClinicalToolParams({ query = '', category = '', limit = 30 }) {
  const params = new URLSearchParams({
    select: CLINICAL_TOOL_SELECT,
    status: 'eq.published',
    order: 'title.asc',
    limit: String(parseLimit(limit)),
  });
  const terms = getSearchTerms(query);

  if (terms.length > 0) {
    const orParts = terms.flatMap((term) => [
      `title.ilike.*${term}*`,
      `category.ilike.*${term}*`,
      `subcategory.ilike.*${term}*`,
      `description.ilike.*${term}*`,
      `search_terms.ilike.*${term}*`,
    ]);
    params.set('or', `(${orParts.join(',')})`);
  }

  if (category) {
    params.set('category', `eq.${normalizeText(category)}`);
  }

  return params;
}

function clinicalToolMatchesQuery(tool, query) {
  const terms = getSearchTerms(query);

  if (terms.length === 0) {
    return true;
  }

  const haystack = stripAccents([
    tool.title,
    tool.category,
    tool.subcategory,
    tool.description,
    tool.sourceReference,
    tool.toolType,
    ...tool.fields.map((field) => field.label),
  ].join(' ')).toLowerCase();

  return terms.every((term) => haystack.includes(stripAccents(term).toLowerCase()));
}

async function listClinicalTools({ query = '', category = '', limit = 30 } = {}) {
  if (!isClinicalToolsStorageAvailable()) {
    return [];
  }

  const params = buildClinicalToolParams({ query, category, limit });

  try {
    const json = await requestClinicalTools(`clinical_tools?${params.toString()}`, { method: 'GET' });
    const tools = Array.isArray(json) ? json.map(mapClinicalToolRow).filter(Boolean) : [];

    return tools
      .filter((tool) => tool.validation.valid)
      .filter((tool) => clinicalToolMatchesQuery(tool, query))
      .slice(0, parseLimit(limit));
  } catch (error) {
    if (isMissingClinicalToolsTable(error)) {
      return [];
    }

    throw error;
  }
}

async function getClinicalToolBySlug(slug) {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug || !isClinicalToolsStorageAvailable()) {
    return null;
  }

  const params = new URLSearchParams({
    select: CLINICAL_TOOL_SELECT,
    slug: `eq.${normalizedSlug}`,
    status: 'eq.published',
    limit: '1',
  });

  try {
    const json = await requestClinicalTools(`clinical_tools?${params.toString()}`, { method: 'GET' });
    const row = Array.isArray(json) ? json[0] : null;
    const tool = mapClinicalToolRow(row);

    return tool?.validation?.valid ? tool : null;
  } catch (error) {
    if (isMissingClinicalToolsTable(error)) {
      return null;
    }

    throw error;
  }
}

module.exports = {
  getClinicalToolBySlug,
  isClinicalToolsStorageAvailable,
  listClinicalTools,
  normalizeAlertColor,
  normalizeClinicalToolSchema: mapClinicalToolRow,
  normalizeSlug,
  normalizeToolType,
  validateClinicalToolSchema,
};
