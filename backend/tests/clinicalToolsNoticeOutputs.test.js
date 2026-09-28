const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeClinicalToolSchema } = require('../services/clinicalTools');

// Trava de faixa etaria como na fluidoterapia pediatrica: a saida e um aviso, e
// so a faixa de recem-nascido bloqueia os demais resultados.
function buildTool(gateOverrides = {}, rnRangeOverrides = {}) {
  return normalizeClinicalToolSchema({
    slug: 'ferramenta-teste',
    title: 'Ferramenta teste',
    tool_type: 'math_formula',
    fields: [],
    engine_config: {
      unit: 'ml/dia',
      outputs: [
        {
          id: 'aviso_faixa_etaria',
          label: 'Aplicabilidade por faixa etária',
          formula: 'ifelse(faixa_etaria == 1, 1, 0)',
          ...gateOverrides,
          result_ranges: [
            {
              min: 1,
              max: 1,
              cor_alerta: 'red',
              classificacao: 'Não use esta calculadora',
              orientacao: 'Não se aplica a recém-nascido.',
              ...rnRangeOverrides,
            },
            {
              min: 0,
              max: 0,
              cor_alerta: 'gray',
              classificacao: 'Faixa etária adequada',
              orientacao: 'Aplicável a partir de 28 dias.',
            },
          ],
        },
        { id: 'manutencao', label: 'Necessidade hídrica', formula: 'peso * 100' },
      ],
    },
  });
}

function gate(tool) {
  return tool.engineConfig.outputs.find((output) => output.id === 'aviso_faixa_etaria');
}

test('chaves em portugues do CMS sobrevivem a normalizacao', () => {
  const tool = buildTool({ exibir_como_aviso: true }, { bloqueia_resultados: true });
  const [rn, adequada] = gate(tool).resultRanges;

  assert.equal(gate(tool).showAsNotice, true);
  assert.equal(rn.blocksResults, true);
  // So a faixa marcada bloqueia: a de >= 28 dias precisa liberar os resultados.
  assert.equal(adequada.blocksResults, false);
});

test('aliases em ingles e camelCase tambem sao aceitos', () => {
  const snake = buildTool({ show_as_notice: true }, { blocks_results: true });
  const camel = buildTool({ showAsNotice: 'sim' }, { blocksResults: 'true' });

  assert.equal(gate(snake).showAsNotice, true);
  assert.equal(gate(snake).resultRanges[0].blocksResults, true);
  assert.equal(gate(camel).showAsNotice, true);
  assert.equal(gate(camel).resultRanges[0].blocksResults, true);
});

test('sem as chaves nada muda: ferramentas antigas seguem mostrando valores', () => {
  const tool = buildTool();
  const saida = tool.engineConfig.outputs.find((output) => output.id === 'manutencao');

  assert.equal(gate(tool).showAsNotice, false);
  assert.equal(gate(tool).resultRanges[0].blocksResults, false);
  assert.equal(saida.showAsNotice, false);
});
