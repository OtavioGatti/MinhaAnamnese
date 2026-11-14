const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeClinicalToolSchema } = require('../services/clinicalTools');

// Campo condicional: a faixa de hemoglobina do Blatchford depende do sexo, e nao
// pode ser perguntada fora da condicao. Se a condicao apontar para campo ou valor
// que nao existe, o campo sumiria da tela sem nunca ser perguntado e o escore
// sairia menor do que o caso, sem aviso nenhum -- por isso a ferramenta nao publica.
function buildTool(overrides = {}) {
  return normalizeClinicalToolSchema({
    slug: 'ferramenta-teste',
    title: 'Ferramenta teste',
    tool_type: 'sum_points',
    fields: [
      {
        id: 'sexo',
        label: 'Sexo',
        input_type: 'select',
        options: [
          { label: 'Masculino', value: 'masculino', numeric_value: 0 },
          { label: 'Feminino', value: 'feminino', numeric_value: 0 },
        ],
      },
      {
        id: 'hemoglobina_homens',
        label: 'Hemoglobina',
        input_type: 'select',
        visible_when: { field_id: 'sexo', values: ['masculino'] },
        options: [
          { label: '>= 13,0 g/dL', value: 'maior_ou_igual_13', numeric_value: 0 },
          { label: '< 10,0 g/dL', value: 'menor_10', numeric_value: 6 },
        ],
        ...overrides,
      },
    ],
    result_ranges: [
      { min: 0, max: 1, classification: 'Risco muito baixo', orientation: 'Ambulatorial.' },
    ],
  });
}

function conditionalField(tool) {
  return tool.fields.find((field) => field.id === 'hemoglobina_homens');
}

test('regra de visibilidade do CMS sobrevive a normalizacao', () => {
  const tool = buildTool();

  assert.deepEqual(conditionalField(tool).visibleWhen, { fieldId: 'sexo', values: ['masculino'] });
  assert.equal(tool.validation.valid, true);
});

test('aliases em portugues, camelCase e valor unico sao aceitos', () => {
  const tool = buildTool({ visivel_quando: { campo: 'sexo', valor: 'masculino' }, visible_when: undefined });

  assert.deepEqual(conditionalField(tool).visibleWhen, { fieldId: 'sexo', values: ['masculino'] });

  const camel = buildTool({ visible_when: undefined, visibleWhen: { fieldId: 'sexo', values: ['feminino'] } });

  assert.deepEqual(conditionalField(camel).visibleWhen, { fieldId: 'sexo', values: ['feminino'] });
});

test('campo sem condicao continua sem regra', () => {
  const tool = buildTool({ visible_when: undefined });

  assert.equal(conditionalField(tool).visibleWhen, null);
  assert.equal(tool.validation.valid, true);
});

test('condicao apontando para campo inexistente reprova a ferramenta', () => {
  const tool = buildTool({ visible_when: { field_id: 'genero', values: ['masculino'] } });

  assert.equal(tool.validation.valid, false);
  assert.ok(tool.validation.errors.some((error) => error.includes('campo inexistente')));
});

test('condicao com valor que a opcao nao tem reprova a ferramenta', () => {
  const tool = buildTool({ visible_when: { field_id: 'sexo', values: ['homem'] } });

  assert.equal(tool.validation.valid, false);
  assert.ok(tool.validation.errors.some((error) => error.includes('valor inexistente')));
});

test('condicao apontando para o proprio campo reprova a ferramenta', () => {
  const tool = buildTool({ visible_when: { field_id: 'hemoglobina_homens', values: ['menor_10'] } });

  assert.equal(tool.validation.valid, false);
  assert.ok(tool.validation.errors.some((error) => error.includes('proprio campo') || error.includes('próprio campo')));
});

test('campo que condiciona outro precisa ser obrigatorio', () => {
  const tool = normalizeClinicalToolSchema({
    slug: 'ferramenta-teste',
    title: 'Ferramenta teste',
    tool_type: 'sum_points',
    fields: [
      {
        id: 'sexo',
        label: 'Sexo',
        input_type: 'select',
        required: false,
        options: [{ label: 'Masculino', value: 'masculino', numeric_value: 0 }],
      },
      {
        id: 'hemoglobina_homens',
        label: 'Hemoglobina',
        input_type: 'select',
        visible_when: { field_id: 'sexo', values: ['masculino'] },
        options: [{ label: '>= 13,0 g/dL', value: 'maior_ou_igual_13', numeric_value: 0 }],
      },
    ],
  });

  assert.equal(tool.validation.valid, false);
  assert.ok(tool.validation.errors.some((error) => error.includes('obrigatório')));
});

test('condicao em cadeia reprova a ferramenta', () => {
  const tool = normalizeClinicalToolSchema({
    slug: 'ferramenta-teste',
    title: 'Ferramenta teste',
    tool_type: 'sum_points',
    fields: [
      {
        id: 'sexo',
        label: 'Sexo',
        input_type: 'select',
        options: [{ label: 'Masculino', value: 'masculino', numeric_value: 0 }],
      },
      {
        id: 'gestante',
        label: 'Gestante',
        input_type: 'select',
        visible_when: { field_id: 'sexo', values: ['masculino'] },
        options: [{ label: 'Sim', value: 'sim', numeric_value: 1 }],
      },
      {
        id: 'trimestre',
        label: 'Trimestre',
        input_type: 'select',
        visible_when: { field_id: 'gestante', values: ['sim'] },
        options: [{ label: 'Primeiro', value: 'primeiro', numeric_value: 1 }],
      },
    ],
  });

  assert.equal(tool.validation.valid, false);
  assert.ok(tool.validation.errors.some((error) => error.includes('condicional')));
});
