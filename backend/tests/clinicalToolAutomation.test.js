const test = require('node:test');
const assert = require('node:assert');

const {
  AUTOMATABLE_ENGINE_TYPES,
  STATUS_AUTOMACAO_GERADO,
  applyToolLock,
  buildClinicalToolSchema,
  finalizeClinicalTool,
  findScoreCoverageErrors,
  normalizeClinicalTool,
  shouldHoldFromSync,
  validateGeneratedTool,
} = require('../contracts/clinicalToolAutomation');
const { buildWritableTool } = require('../services/notionClinicalToolWriter');

const ENUM_OPTIONS = {
  category: ['Cardiologia', 'Clínica médica', 'Outro'],
  subcategory: ['Scores de risco', 'Calculadoras', 'Outro'],
};

function buildValidScore(overrides = {}) {
  return {
    title: 'Escore de Centor',
    slug: 'escore-de-centor',
    category: 'Clínica médica',
    subcategory: 'Scores de risco',
    description: 'Estima a probabilidade de faringite estreptocócica.',
    source_reference: 'Centor RM, 1981',
    search_tags: 'centor / faringite',
    tool_type: 'SOMA_PONTOS',
    fields: [
      {
        id: 'exsudato',
        label: 'Exsudato tonsilar',
        input_type: 'select',
        helper_text: '',
        unit: '',
        min: null,
        max: null,
        step: null,
        options: [
          { label: 'Sim', value: 'sim', numeric_value: 1, helper_text: '' },
          { label: 'Não', value: 'nao', numeric_value: 0, helper_text: '' },
        ],
      },
      {
        id: 'febre',
        label: 'História de febre',
        input_type: 'select',
        helper_text: '',
        unit: '',
        min: null,
        max: null,
        step: null,
        options: [
          { label: 'Sim', value: 'sim', numeric_value: 1, helper_text: '' },
          { label: 'Não', value: 'nao', numeric_value: 0, helper_text: '' },
        ],
      },
    ],
    engine_config: {
      formula: '',
      precision: 0,
      unit: '',
      score_label: 'pontos',
      result_label: 'Escore de Centor',
    },
    result_ranges: [
      { min: 0, max: 1, classification: 'Baixo risco', alert_color: 'green', orientation: 'Baixa probabilidade.' },
      { min: 2, max: 2, classification: 'Risco intermediário', alert_color: 'yellow', orientation: 'Considerar teste.' },
    ],
    ...overrides,
  };
}

test('a trava de revisão retém o que a IA gerou até o sync manual', () => {
  assert.equal(shouldHoldFromSync(STATUS_AUTOMACAO_GERADO), true);
  assert.equal(shouldHoldFromSync(STATUS_AUTOMACAO_GERADO, { bypassReviewGate: true }), false);
  assert.equal(shouldHoldFromSync('a gerar'), true);
  // Nem o sync manual publica o que está na fila ou deu erro.
  assert.equal(shouldHoldFromSync('a gerar', { bypassReviewGate: true }), true);
  assert.equal(shouldHoldFromSync('erro na automação', { bypassReviewGate: true }), true);
  // Linha nunca tocada pela automação segue o fluxo normal.
  assert.equal(shouldHoldFromSync(''), false);
});

test('applyToolLock força rascunho — IA não publica calculadora', () => {
  const locked = applyToolLock({ title: 'X', publication_status: 'published' });

  assert.equal(locked.publication_status, 'draft');
  assert.equal(locked.automation_status, STATUS_AUTOMACAO_GERADO);
});

test('schema strict: additionalProperties false e required cobre todas as chaves', () => {
  const schema = buildClinicalToolSchema(ENUM_OPTIONS);

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  assert.deepEqual(schema.properties.category.enum, ENUM_OPTIONS.category);
  assert.deepEqual(schema.properties.tool_type.enum, AUTOMATABLE_ENGINE_TYPES);

  const fieldSchema = schema.properties.fields.items;
  assert.equal(fieldSchema.additionalProperties, false);
  assert.deepEqual([...fieldSchema.required].sort(), Object.keys(fieldSchema.properties).sort());

  const optionSchema = fieldSchema.properties.options.items;
  assert.deepEqual([...optionSchema.required].sort(), Object.keys(optionSchema.properties).sort());
});

test('LOGICA_CONDICIONAL fica fora do enum: checklists com eixo seguem manuais', () => {
  const schema = buildClinicalToolSchema(ENUM_OPTIONS);
  assert.ok(!schema.properties.tool_type.enum.includes('LOGICA_CONDICIONAL'));
});

test('normalizeClinicalTool descarta categoria fora das opções vivas', () => {
  const tool = normalizeClinicalTool(
    { ...buildValidScore(), category: 'Homeopatia', subcategory: 'Scores de risco' },
    ENUM_OPTIONS,
  );

  assert.equal(tool.category, '');
  assert.equal(tool.subcategory, 'Scores de risco');
});

test('sem opções vivas do Notion, schema e normalização usam o mesmo fallback', () => {
  // Regressão: o schema oferecia só "Outro" e a normalização descartava, o que
  // deixava toda ferramenta gerada sem categoria quando o data source do Notion
  // não estava configurado.
  const schema = buildClinicalToolSchema({});
  assert.deepEqual(schema.properties.category.enum, ['Outro']);

  const tool = normalizeClinicalTool({ ...buildValidScore(), category: 'Outro', subcategory: 'Outro' }, {});
  assert.equal(tool.category, 'Outro');
  assert.equal(tool.subcategory, 'Outro');
});

test('score válido passa no portão de validação', () => {
  const result = validateGeneratedTool(buildValidScore());
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('reprova score cujas faixas não cobrem a pontuação máxima possível', () => {
  // Máximo alcançável é 2 (1 + 1), mas as faixas param em 1.
  const tool = buildValidScore({
    result_ranges: [
      { min: 0, max: 1, classification: 'Baixo risco', alert_color: 'green', orientation: 'ok' },
    ],
  });

  const errors = findScoreCoverageErrors(tool);
  assert.ok(errors.some((error) => error.includes('máxima possível (2)')));
  assert.equal(validateGeneratedTool(tool).valid, false);
});

test('checkbox soma todas as opções ao calcular a pontuação máxima', () => {
  const tool = buildValidScore({
    fields: [{
      id: 'sintomas',
      label: 'Sintomas presentes',
      input_type: 'checkbox',
      helper_text: '',
      unit: '',
      min: null,
      max: null,
      step: null,
      options: [
        { label: 'A', value: 'a', numeric_value: 1, helper_text: '' },
        { label: 'B', value: 'b', numeric_value: 2, helper_text: '' },
      ],
    }],
    result_ranges: [
      { min: 0, max: 2, classification: 'Baixo', alert_color: 'green', orientation: 'ok' },
    ],
  });

  const errors = findScoreCoverageErrors(tool);
  assert.ok(errors.some((error) => error.includes('máxima possível (3)')));
});

test('faixa aberta (max null) cobre o extremo superior', () => {
  const tool = buildValidScore({
    result_ranges: [
      { min: null, max: 1, classification: 'Baixo', alert_color: 'green', orientation: 'ok' },
      { min: 2, max: null, classification: 'Alto', alert_color: 'red', orientation: 'ok' },
    ],
  });

  assert.deepEqual(findScoreCoverageErrors(tool), []);
});

test('reprova fórmula que cita campo inexistente', () => {
  const tool = buildValidScore({
    tool_type: 'FORMULA_MATEMATICA',
    fields: [{
      id: 'peso',
      label: 'Peso',
      input_type: 'number',
      helper_text: '',
      unit: 'kg',
      min: 0,
      max: 400,
      step: 0.1,
      options: [],
    }],
    engine_config: {
      formula: 'peso / (altura * altura)',
      precision: 1,
      unit: 'kg/m²',
      score_label: '',
      result_label: 'IMC',
    },
    result_ranges: [
      { min: null, max: null, classification: 'Resultado', alert_color: 'gray', orientation: 'ok' },
    ],
  });

  const result = validateGeneratedTool(tool);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('fórmula')));
});

test('fórmula válida com todos os campos declarados passa', () => {
  const tool = buildValidScore({
    tool_type: 'FORMULA_MATEMATICA',
    fields: [
      {
        id: 'peso', label: 'Peso', input_type: 'number', helper_text: '', unit: 'kg',
        min: 0, max: 400, step: 0.1, options: [],
      },
      {
        id: 'altura', label: 'Altura', input_type: 'number', helper_text: '', unit: 'm',
        min: 0, max: 3, step: 0.01, options: [],
      },
    ],
    engine_config: {
      formula: 'peso / (altura * altura)',
      precision: 1,
      unit: 'kg/m²',
      score_label: '',
      result_label: 'IMC',
    },
    result_ranges: [
      { min: null, max: 18.4, classification: 'Baixo peso', alert_color: 'yellow', orientation: 'ok' },
      { min: 18.5, max: null, classification: 'Adequado ou acima', alert_color: 'green', orientation: 'ok' },
    ],
  });

  assert.deepEqual(validateGeneratedTool(tool).errors, []);
});

test('reprova ferramenta sem campos — o caso "não conheço o instrumento"', () => {
  const tool = finalizeClinicalTool(
    { ...buildValidScore(), fields: [], result_ranges: [] },
    ENUM_OPTIONS,
  );

  const result = validateGeneratedTool(tool);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('campos')));
});

test('buildWritableTool serializa os três objetos como JSON de volta ao formato do sync', () => {
  const writable = buildWritableTool(buildValidScore());

  assert.equal(typeof writable.fields_json, 'string');
  assert.equal(typeof writable.engine_config_json, 'string');
  assert.equal(typeof writable.result_ranges_json, 'string');
  // O que é escrito precisa voltar igual quando o sync fizer JSON.parse.
  assert.deepEqual(JSON.parse(writable.fields_json), buildValidScore().fields);
  assert.deepEqual(JSON.parse(writable.result_ranges_json), buildValidScore().result_ranges);
});
