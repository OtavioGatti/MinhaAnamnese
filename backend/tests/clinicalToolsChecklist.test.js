const assert = require('node:assert/strict');
const path = require('node:path');
const { before, describe, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const {
  normalizeClinicalToolSchema,
} = require('../services/clinicalTools');

const CHECKLIST_MODULE_URL = pathToFileURL(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'clinicalChecklist.js'),
).href;

const AGE_OPTIONS = [2, 4, 6, 9, 12, 18, 24].map((months) => ({
  label: `${months} meses`,
  numeric_value: months,
}));

const PRESENCE_OPTIONS = [
  { label: 'Presente', numeric_value: 0 },
  { label: 'Ausente', numeric_value: 1 },
];

function buildMilestoneField(id, label, applicableFrom, alertFrom, applicableUntil) {
  return {
    id,
    label,
    tipo_input: 'RADIO',
    required: true,
    opcoes: PRESENCE_OPTIONS,
    ...(applicableFrom == null ? {} : { applicable_from: applicableFrom }),
    ...(alertFrom == null ? {} : { alert_from: alertFrom }),
    ...(applicableUntil == null ? {} : { applicable_until: applicableUntil }),
  };
}

function buildMilestonesToolRow(overrides = {}) {
  return {
    slug: 'marcos-desenvolvimento-infantil',
    title: 'Marcos do Desenvolvimento Infantil',
    tool_type: 'conditional_logic',
    status: 'published',
    engine_config: {
      score_label: 'marcos de alerta ausentes',
      result_label: 'Avaliação do desenvolvimento',
      axis_field_id: 'idade',
      axis_unit: 'meses',
      preview_window: 2,
      ...(overrides.engine_config || {}),
    },
    fields: overrides.fields || [
      {
        id: 'idade',
        label: 'Faixa etária',
        tipo_input: 'SELECT',
        required: true,
        opcoes: AGE_OPTIONS,
      },
      buildMilestoneField('sustenta_cabeca', 'Sustenta a cabeça', 2, 4),
      buildMilestoneField('rola', 'Rola sozinho', 4, 6),
      buildMilestoneField('senta_sem_apoio', 'Senta sem apoio', 6, 9),
      buildMilestoneField('engatinha', 'Engatinha', 9, null),
      buildMilestoneField('anda_sem_apoio', 'Anda sem apoio', 12, 18),
    ],
    result_ranges: [
      { min: 0, max: 0, classificacao: 'Desenvolvimento compatível com a idade', cor_alerta: 'green' },
      { min: 1, max: 2, classificacao: 'Atenção', cor_alerta: 'yellow' },
      { min: 3, max: 99, classificacao: 'Suspeita de atraso do desenvolvimento', cor_alerta: 'red' },
    ],
  };
}

function buildLegacyScoreRow() {
  return {
    slug: 'heart-score-dor-toracica',
    title: 'HEART Score para dor torácica',
    tool_type: 'sum_points',
    status: 'published',
    engine_config: { score_label: 'pontos' },
    fields: [
      {
        id: 'historia',
        label: 'História',
        tipo_input: 'RADIO',
        opcoes: [
          { label: 'Pouco suspeita', numeric_value: 0 },
          { label: 'Muito suspeita', numeric_value: 2 },
        ],
      },
    ],
    result_ranges: [{ min: 0, max: 3, classificacao: 'Baixo risco' }],
  };
}

describe('normalização do checklist condicional', () => {
  test('mapeia limiares do item e a configuração do eixo', () => {
    const tool = normalizeClinicalToolSchema(buildMilestonesToolRow());

    assert.equal(tool.validation.valid, true);
    assert.equal(tool.engineConfig.axisFieldId, 'idade');
    assert.equal(tool.engineConfig.axisUnit, 'meses');
    assert.equal(tool.engineConfig.previewWindow, 2);

    const rola = tool.fields.find((field) => field.id === 'rola');
    assert.equal(rola.applicableFrom, 4);
    assert.equal(rola.alertFrom, 6);

    const engatinha = tool.fields.find((field) => field.id === 'engatinha');
    assert.equal(engatinha.applicableFrom, 9);
    assert.equal(engatinha.alertFrom, null);
  });

  test('deriva o desfecho da opção pelo valor numérico e aceita rótulo explícito', () => {
    const tool = normalizeClinicalToolSchema(buildMilestonesToolRow());
    const [presente, ausente] = tool.fields.find((field) => field.id === 'rola').options;

    assert.equal(presente.outcome, 'present');
    assert.equal(ausente.outcome, 'absent');

    const withExplicitOutcome = normalizeClinicalToolSchema(buildMilestonesToolRow({
      fields: [
        {
          id: 'idade',
          label: 'Faixa etária',
          tipo_input: 'SELECT',
          opcoes: AGE_OPTIONS,
        },
        {
          id: 'dose_bcg',
          label: 'BCG',
          tipo_input: 'RADIO',
          applicable_from: 2,
          opcoes: [
            { label: 'Aplicada', numeric_value: 0 },
            { label: 'Não aplicada', numeric_value: 1 },
            { label: 'Contraindicada', numeric_value: 0, outcome: 'nao_se_aplica' },
          ],
        },
      ],
    }));
    const doses = withExplicitOutcome.fields.find((field) => field.id === 'dose_bcg').options;

    assert.deepEqual(doses.map((option) => option.outcome), ['present', 'absent', 'not_applicable']);
  });

  test('rejeita configurações de eixo que silenciariam o filtro por faixa', () => {
    const missingAxisField = normalizeClinicalToolSchema(buildMilestonesToolRow({
      engine_config: { axis_field_id: 'faixa_etaria' },
    }));
    assert.equal(missingAxisField.validation.valid, false);
    assert.ok(missingAxisField.validation.errors.includes('campo eixo inexistente'));

    const thresholdsWithoutAxis = normalizeClinicalToolSchema({
      ...buildMilestonesToolRow(),
      engine_config: { score_label: 'falhas' },
    });
    assert.equal(thresholdsWithoutAxis.validation.valid, false);
    assert.ok(thresholdsWithoutAxis.validation.errors.some((error) => error.includes('campo eixo')));

    const invertedThresholds = normalizeClinicalToolSchema(buildMilestonesToolRow({
      fields: [
        { id: 'idade', label: 'Faixa etária', tipo_input: 'SELECT', opcoes: AGE_OPTIONS },
        buildMilestoneField('rola', 'Rola sozinho', 9, 4),
      ],
    }));
    assert.equal(invertedThresholds.validation.valid, false);
    assert.ok(invertedThresholds.validation.errors.some((error) => error.includes('alerta anterior')));

    const retiredBeforeAlert = normalizeClinicalToolSchema(buildMilestonesToolRow({
      fields: [
        { id: 'idade', label: 'Faixa etária', tipo_input: 'SELECT', opcoes: AGE_OPTIONS },
        buildMilestoneField('rola', 'Rola sozinho', 4, 9, 6),
      ],
    }));
    assert.equal(retiredBeforeAlert.validation.valid, false);
    assert.ok(retiredBeforeAlert.validation.errors.some((error) => error.includes('antes do alerta')));
  });

  test('ferramentas sem eixo seguem válidas e sem campos de checklist ativos', () => {
    const tool = normalizeClinicalToolSchema(buildLegacyScoreRow());

    assert.equal(tool.validation.valid, true);
    assert.equal(tool.engineConfig.axisFieldId, '');
    assert.equal(tool.engineConfig.previewWindow, 0);
    assert.equal(tool.fields[0].applicableFrom, null);
    assert.equal(tool.fields[0].alertFrom, null);
  });
});

describe('avaliação do checklist condicional', () => {
  let checklist;
  let tool;

  before(async () => {
    checklist = await import(CHECKLIST_MODULE_URL);
    tool = normalizeClinicalToolSchema(buildMilestonesToolRow());
  });

  test('só reconhece como checklist quem declara um eixo existente', () => {
    assert.equal(checklist.isChecklistTool(tool), true);
    assert.equal(checklist.isChecklistTool(normalizeClinicalToolSchema(buildLegacyScoreRow())), false);
  });

  test('sem idade informada, nenhum marco é exibido nem cobrado', () => {
    const evaluation = checklist.evaluateChecklist(tool, {});

    assert.equal(evaluation.axisValue, null);
    assert.deepEqual(evaluation.activeFields.map((field) => field.id), ['idade']);
    assert.equal(evaluation.missingFields.length, 0);
    assert.equal(evaluation.ready, false);
  });

  test('marcos acima da faixa etária ficam fora do formulário e do resultado', () => {
    const evaluation = checklist.evaluateChecklist(tool, { idade: '4_meses' });

    assert.equal(evaluation.axisValue, 4);
    assert.deepEqual(
      evaluation.activeFields.map((field) => field.id),
      ['idade', 'sustenta_cabeca', 'rola'],
    );
    // Dentro da janela de previsão (6 - 2), mas ainda não avaliado.
    assert.deepEqual(evaluation.upcomingItems.map((item) => item.id), ['senta_sem_apoio']);
    assert.equal(evaluation.upcomingItems[0].expectedText, '6 meses');
    assert.equal(evaluation.alertCount, 0);
  });

  test('ausência antes do limiar de alerta é acompanhamento, não alerta', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '4_meses',
      sustenta_cabeca: 'ausente',
      rola: 'ausente',
    });

    assert.deepEqual(evaluation.groups.alert.map((item) => item.id), ['sustenta_cabeca']);
    assert.deepEqual(evaluation.groups.watch.map((item) => item.id), ['rola']);
    assert.equal(evaluation.alertCount, 1);
    assert.equal(evaluation.ready, true);
  });

  test('criança de 4 meses com marcos da idade presentes não gera falha', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '4_meses',
      sustenta_cabeca: 'presente',
      rola: 'presente',
    });

    assert.equal(evaluation.alertCount, 0);
    assert.equal(evaluation.groups.watch.length, 0);
    assert.equal(evaluation.ready, true);
    assert.deepEqual(evaluation.groups.present.map((item) => item.id), ['sustenta_cabeca', 'rola']);
  });

  test('resultado só fica pronto com todos os itens aplicáveis respondidos', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '12_meses',
      sustenta_cabeca: 'presente',
    });

    assert.equal(evaluation.ready, false);
    assert.deepEqual(
      evaluation.missingFields.map((field) => field.id),
      ['rola', 'senta_sem_apoio', 'engatinha', 'anda_sem_apoio'],
    );
  });

  test('item já superado pela faixa atual sai do formulário e do resultado', () => {
    const withRetirement = normalizeClinicalToolSchema(buildMilestonesToolRow({
      fields: [
        { id: 'idade', label: 'Faixa etária', tipo_input: 'SELECT', opcoes: AGE_OPTIONS },
        buildMilestoneField('sustenta_cabeca', 'Sustenta a cabeça', 2, 4, 6),
        buildMilestoneField('senta_sem_apoio', 'Senta sem apoio', 6, 9, 12),
      ],
    }));
    const evaluation = checklist.evaluateChecklist(withRetirement, {
      idade: '12_meses',
      // Resposta antiga preservada no estado não pode voltar a contar.
      sustenta_cabeca: 'ausente',
      senta_sem_apoio: 'presente',
    });

    assert.deepEqual(evaluation.activeFields.map((field) => field.id), ['idade', 'senta_sem_apoio']);
    assert.equal(evaluation.alertCount, 0);
    assert.equal(evaluation.ready, true);
  });

  test('item sem limiar próprio alerta assim que passa a ser esperado', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '9_meses',
      sustenta_cabeca: 'presente',
      rola: 'presente',
      senta_sem_apoio: 'presente',
      engatinha: 'ausente',
    });

    assert.deepEqual(evaluation.groups.alert.map((item) => item.id), ['engatinha']);
  });

  test('texto copiado descreve presentes, ausentes e próximos marcos', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '4_meses',
      sustenta_cabeca: 'presente',
      rola: 'ausente',
    });
    const text = checklist.buildChecklistCopyText(tool, evaluation, {
      classification: 'Atenção',
      orientation: 'Reavaliar em 30 dias.',
    });

    assert.match(text, /^Marcos do Desenvolvimento Infantil \(Faixa etária: 4 meses\)$/m);
    assert.match(text, /^Ausentes \(acompanhar\): Rola sozinho$/m);
    assert.match(text, /^Presentes: Sustenta a cabeça$/m);
    assert.match(text, /^Próximos marcos a observar: Senta sem apoio \(esperado: 6 meses\)$/m);
    assert.match(text, /^Classificação: Atenção$/m);
    assert.match(text, /^Orientação: Reavaliar em 30 dias\.$/m);
    assert.doesNotMatch(text, /Engatinha|Anda sem apoio/);
  });

  test('texto copiado separa marcos de alerta ausentes', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '9_meses',
      sustenta_cabeca: 'presente',
      rola: 'presente',
      senta_sem_apoio: 'ausente',
      engatinha: 'ausente',
    });
    const text = checklist.buildChecklistCopyText(tool, evaluation, { classification: 'Atenção' });

    assert.match(text, /^Ausentes \(marco de alerta\): Senta sem apoio; Engatinha$/m);
    assert.match(text, /^Presentes: Sustenta a cabeça; Rola sozinho$/m);
  });

  test('eixo em zero é resposta válida e não bloqueia o resultado', () => {
    const schedule = normalizeClinicalToolSchema({
      slug: 'calendario-vacinal',
      title: 'Calendário vacinal',
      tool_type: 'conditional_logic',
      status: 'published',
      engine_config: { axis_field_id: 'idade', axis_unit: 'meses', preview_window: 2 },
      fields: [
        {
          id: 'idade',
          label: 'Idade',
          tipo_input: 'SELECT',
          opcoes: [{ label: 'Ao nascer', numeric_value: 0 }, { label: '2 meses', numeric_value: 2 }],
        },
        {
          id: 'bcg',
          label: 'BCG',
          tipo_input: 'RADIO',
          applicable_from: 0,
          alert_from: 2,
          expected_label: 'ao nascer',
          opcoes: [
            { label: 'Aplicada', numeric_value: 0 },
            { label: 'Não aplicada', numeric_value: 1 },
            { label: 'Contraindicada', numeric_value: 0, outcome: 'nao_se_aplica' },
          ],
        },
      ],
      result_ranges: [{ min: 0, max: 0, classificacao: 'Em dia' }],
    });

    assert.equal(schedule.validation.valid, true);

    const evaluation = checklist.evaluateChecklist(schedule, { idade: 'ao_nascer', bcg: 'aplicada' });

    assert.equal(evaluation.axisValue, 0);
    assert.equal(evaluation.ready, true);
    assert.deepEqual(evaluation.groups.present.map((item) => item.id), ['bcg']);
    // Rótulo próprio no lugar de "0 meses".
    assert.equal(evaluation.groups.present[0].expectedText, 'ao nascer');
  });

  test('opção "não se aplica" sai do resultado sem virar alerta', () => {
    const schedule = normalizeClinicalToolSchema({
      slug: 'calendario-vacinal',
      title: 'Calendário vacinal',
      tool_type: 'conditional_logic',
      status: 'published',
      engine_config: { axis_field_id: 'idade', axis_unit: 'meses' },
      fields: [
        {
          id: 'idade',
          label: 'Idade',
          tipo_input: 'SELECT',
          opcoes: [{ label: '12 meses', numeric_value: 12 }],
        },
        {
          id: 'rotavirus_1',
          label: 'Rotavírus — 1ª dose',
          tipo_input: 'RADIO',
          applicable_from: 2,
          alert_from: 4,
          opcoes: [
            { label: 'Aplicada', numeric_value: 0 },
            { label: 'Não aplicada', numeric_value: 1 },
            { label: 'Fora da idade limite', numeric_value: 0, outcome: 'nao_se_aplica' },
          ],
        },
      ],
      result_ranges: [],
    });
    const evaluation = checklist.evaluateChecklist(schedule, {
      idade: '12_meses',
      rotavirus_1: 'fora_da_idade_limite',
    });

    assert.equal(evaluation.alertCount, 0);
    assert.equal(evaluation.groups.alert.length, 0);
    assert.deepEqual(evaluation.groups.notApplicable.map((item) => item.id), ['rotavirus_1']);
    assert.equal(evaluation.ready, true);
  });

  test('domínio sub-agrupa o resultado sem mexer na contagem de alertas', () => {
    const prenatal = normalizeClinicalToolSchema({
      slug: 'pre-natal',
      title: 'Pré-natal',
      tool_type: 'conditional_logic',
      status: 'published',
      engine_config: { axis_field_id: 'ig', axis_unit: 'semanas' },
      fields: [
        {
          id: 'ig',
          label: 'Idade gestacional',
          tipo_input: 'SELECT',
          opcoes: [{ label: '24 semanas', numeric_value: 24 }],
        },
        {
          id: 'totg',
          label: 'TOTG 75g',
          tipo_input: 'RADIO',
          domain: 'Exames laboratoriais',
          applicable_from: 24,
          opcoes: [{ label: 'Realizado', numeric_value: 0 }, { label: 'Pendente', numeric_value: 1 }],
        },
        {
          id: 'dtpa',
          label: 'dTpa',
          tipo_input: 'RADIO',
          dominio: 'Vacinas',
          applicable_from: 20,
          opcoes: [{ label: 'Aplicada', numeric_value: 0 }, { label: 'Pendente', numeric_value: 1 }],
        },
      ],
      result_ranges: [],
    });

    assert.equal(prenatal.fields[1].domain, 'Exames laboratoriais');
    assert.equal(prenatal.fields[2].domain, 'Vacinas');

    const evaluation = checklist.evaluateChecklist(prenatal, {
      ig: '24_semanas',
      totg: 'pendente',
      dtpa: 'pendente',
    });

    assert.equal(evaluation.alertCount, 2);
    assert.deepEqual(
      checklist.groupItemsByDomain(evaluation.groups.alert).map((entry) => entry.domain),
      ['Exames laboratoriais', 'Vacinas'],
    );

    const text = checklist.buildChecklistCopyText(prenatal, evaluation, null);
    assert.match(text, /^- Exames laboratoriais: TOTG 75g$/m);
    assert.match(text, /^- Vacinas: dTpa$/m);
  });

  test('item com show_answer registra a resposta junto do rótulo', () => {
    const prenatal = normalizeClinicalToolSchema({
      slug: 'pre-natal',
      title: 'Pré-natal',
      tool_type: 'conditional_logic',
      status: 'published',
      engine_config: { axis_field_id: 'ig', axis_unit: 'semanas' },
      fields: [
        { id: 'ig', label: 'IG', tipo_input: 'SELECT', opcoes: [{ label: '24 semanas', numeric_value: 24 }] },
        { id: 'totg', label: 'TOTG 75g', tipo_input: 'RADIO', applicable_from: 24, opcoes: [{ label: 'Realizado', numeric_value: 0 }, { label: 'Pendente', numeric_value: 1 }] },
        {
          id: 'sangramento',
          label: 'Sangramento vaginal',
          tipo_input: 'RADIO',
          show_answer: true,
          opcoes: [
            { label: 'Não', numeric_value: 0, outcome: 'presente' },
            { label: 'Sim', numeric_value: 1, outcome: 'ausente' },
          ],
        },
      ],
      result_ranges: [],
    });

    assert.equal(prenatal.fields[2].showAnswer, true);
    assert.equal(prenatal.fields[1].showAnswer, false);

    const evaluation = checklist.evaluateChecklist(prenatal, {
      ig: '24_semanas',
      totg: 'realizado',
      sangramento: 'nao',
    });
    const text = checklist.buildChecklistCopyText(prenatal, evaluation, null);

    // Sem a resposta, "Sangramento vaginal" no grupo dos normais seria lido
    // como achado presente.
    assert.match(text, /Sangramento vaginal: Não/);
    assert.doesNotMatch(text, /TOTG 75g: Realizado/);
  });

  test('sem domínio o resumo segue em lista plana', () => {
    const evaluation = checklist.evaluateChecklist(tool, {
      idade: '4_meses',
      sustenta_cabeca: 'ausente',
      rola: 'presente',
    });
    const byDomain = checklist.groupItemsByDomain(evaluation.groups.alert);

    assert.deepEqual(byDomain, [{ domain: '', items: evaluation.groups.alert }]);
    assert.match(
      checklist.buildChecklistCopyText(tool, evaluation, null),
      /^Ausentes \(marco de alerta\): Sustenta a cabeça$/m,
    );
  });

  test('não copia resultado parcial', () => {
    const evaluation = checklist.evaluateChecklist(tool, { idade: '9_meses' });

    assert.equal(checklist.buildChecklistCopyText(tool, evaluation, null), '');
  });
});
