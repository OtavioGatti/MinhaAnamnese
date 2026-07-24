const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildClinicalDrugSchema,
  normalizeClinicalDrug,
  applyClinicalDrugLock,
  finalizeClinicalDrug,
  resolvePregnancyRiskOptions,
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  MODEL_GENERATED_FIELDS,
  FIELD_TO_NOTION,
} = require('../contracts/clinicalDrugAutomation');
const { buildClinicalDrugProperties } = require('../services/notionClinicalDrugWriter');
const {
  resolveCorrectionInstruction,
  getEmptyCompletableFields,
  diffChangedFields,
} = require('../services/correctClinicalDrug');
const { mapNotionPageToClinicalDrug } = require('../services/notionClinicalDrugsSync');

test('schema exige exatamente os campos gerados pelo modelo', () => {
  const schema = buildClinicalDrugSchema({ pregnancy_risk: ['A', 'B', 'C'] });
  assert.deepEqual(schema.required, MODEL_GENERATED_FIELDS);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.pregnancy_risk, { type: 'string', enum: ['A', 'B', 'C'] });
});

test('resolvePregnancyRiskOptions interseca com o conjunto canônico', () => {
  const live = ['A', 'B', 'C', 'D', 'X', 'Indefinido', 'C; D no 3º trimestre', 'Não se aplica'];
  assert.deepEqual(resolvePregnancyRiskOptions(live), ['A', 'B', 'C', 'D', 'X', 'Indefinido', 'Não se aplica']);
  // Sem interseção -> cai no canônico completo.
  assert.ok(resolvePregnancyRiskOptions(['bobagem']).includes('Indefinido'));
});

test('normalizeClinicalDrug deriva slug e filtra risco fora do enum', () => {
  const out = normalizeClinicalDrug(
    { active_ingredient: 'Amoxicilina', pregnancy_risk: 'C; D no 3º trimestre' },
    { pregnancy_risk: ['A', 'B', 'C', 'D', 'X', 'Indefinido'] },
  );
  assert.equal(out.slug, 'amoxicilina');
  assert.equal(out.pregnancy_risk, ''); // fora do enum -> vazio
});

test('a TRAVA injeta o status de automação e nunca sai revisado', () => {
  const gerado = applyClinicalDrugLock({ active_ingredient: 'X' });
  assert.equal(gerado.automation_status, STATUS_AUTOMACAO_GERADO);

  const corrigido = finalizeClinicalDrug(
    { active_ingredient: 'Dipirona', pregnancy_risk: 'B' },
    { pregnancy_risk: ['A', 'B'] },
    { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO },
  );
  assert.equal(corrigido.automation_status, STATUS_AUTOMACAO_CORRIGIDO);
  assert.equal(corrigido.pregnancy_risk, 'B');
});

test('buildClinicalDrugProperties mapeia campo->propriedade e respeita o subset', () => {
  const typeMap = {
    'Princípio Ativo': 'title',
    'Posologia Adulto': 'rich_text',
    'Risco Gestacional': 'select',
    'Status Automação': 'select',
  };
  const drug = {
    active_ingredient: 'Amoxicilina',
    adult_dosage: '500 mg VO 8/8h',
    pregnancy_risk: 'B',
    automation_status: STATUS_AUTOMACAO_GERADO,
  };

  const all = buildClinicalDrugProperties(drug, typeMap);
  assert.ok(all['Princípio Ativo'].title);
  assert.equal(all['Risco Gestacional'].select.name, 'B');
  assert.equal(all['Status Automação'].select.name, STATUS_AUTOMACAO_GERADO);

  // subset: só escreve o status
  const onlyStatus = buildClinicalDrugProperties(drug, typeMap, { fields: ['automation_status'] });
  assert.deepEqual(Object.keys(onlyStatus), ['Status Automação']);
});

test('resolveCorrectionInstruction: manual, auto e nada-a-fazer', () => {
  // manual
  const manual = resolveCorrectionInstruction({ correction_instruction: 'Corrija a posologia pediátrica.' });
  assert.equal(manual.mode, 'manual');
  assert.match(manual.instruction, /posologia pediátrica/i);

  // auto: campos vazios viram instrução automática
  const auto = resolveCorrectionInstruction({
    correction_instruction: '',
    class_category: 'Antibiótico',
    contraindications: 'Alergia',
    adult_dosage: '500 mg',
    // pediatric_dosage, warnings, interactions, presentations, pregnancy_risk, summary_text vazios
  });
  assert.equal(auto.mode, 'auto');
  assert.ok(auto.emptyFields.includes('pediatric_dosage'));
  assert.match(auto.instruction, new RegExp(FIELD_TO_NOTION.pediatric_dosage));

  // nada a fazer: tudo preenchido (inclusive interações estruturadas) e sem instrução
  const full = { interaction_pairs: JSON.stringify([{ target: 'X', severity: 'warning', mechanism: 'm', message: 'msg' }]) };
  for (const key of ['class_category', 'contraindications', 'adult_dosage', 'pediatric_dosage', 'warnings', 'interactions', 'presentations', 'commercial_names_openai', 'pregnancy_risk', 'summary_text']) {
    full[key] = 'preenchido';
  }
  const nothing = resolveCorrectionInstruction({ correction_instruction: '', ...full });
  assert.equal(nothing.instruction, '');

  // interação estruturada vazia é detectada como campo a completar
  const needsPairs = resolveCorrectionInstruction({ correction_instruction: '', ...full, interaction_pairs: '[]' });
  assert.equal(needsPairs.mode, 'auto');
  assert.ok(needsPairs.emptyFields.includes('interaction_pairs'));
});

test('getEmptyCompletableFields e diffChangedFields', () => {
  assert.deepEqual(
    getEmptyCompletableFields({ class_category: 'X', adult_dosage: '  ' }).includes('adult_dosage'),
    true,
  );
  const changed = diffChangedFields(
    { adult_dosage: 'a', warnings: 'w' },
    { adult_dosage: 'b', warnings: 'w' },
  );
  assert.deepEqual(changed, ['adult_dosage']);
});

test('interaction_pairs: entram como needs_review=true (dormentes) com slug derivado', () => {
  const out = normalizeClinicalDrug(
    {
      active_ingredient: 'Imipenem',
      interaction_pairs: [
        { target: 'Ácido valproico', severity: 'danger', mechanism: 'reduz níveis', message: 'risco de convulsões' },
        { target: 'Ácido valproico', severity: 'warning', mechanism: 'dup', message: 'dup' }, // duplicado -> descartado
        { target: '', severity: 'info', mechanism: '', message: '' }, // sem alvo -> descartado
      ],
    },
    { pregnancy_risk: ['C'] },
  );

  assert.equal(out.interaction_pairs.length, 1);
  const pair = out.interaction_pairs[0];
  assert.equal(pair.target_slug, 'acido-valproico');
  assert.equal(pair.severity, 'danger');
  assert.equal(pair.needs_review, true);
  assert.equal(pair.source, 'ai');
});

test('interaction_pairs: aceita string JSON (correção lê da página)', () => {
  const json = JSON.stringify([{ target: 'Probenecida', severity: 'warning', mechanism: 'm', message: 'x' }]);
  const out = normalizeClinicalDrug({ active_ingredient: 'Imipenem', interaction_pairs: json }, {});
  assert.equal(out.interaction_pairs.length, 1);
  assert.equal(out.interaction_pairs[0].target, 'Probenecida');
});

test('gate do sync: página com Status Automação preenchido é RETIDA (held)', () => {
  const heldPage = {
    id: 'page-1',
    properties: {
      'Princípio Ativo': { type: 'title', title: [{ plain_text: 'Nova Bula' }] },
      'Status Automação': { type: 'select', select: { name: STATUS_AUTOMACAO_GERADO } },
    },
  };
  const result = mapNotionPageToClinicalDrug(heldPage);
  assert.equal(result.payload, null);
  assert.ok(result.held);
  assert.equal(result.held.automationStatus, STATUS_AUTOMACAO_GERADO);

  // Página sem Status Automação sincroniza normalmente.
  const normalPage = {
    id: 'page-2',
    properties: {
      'Princípio Ativo': { type: 'title', title: [{ plain_text: 'Amoxicilina' }] },
    },
  };
  const normal = mapNotionPageToClinicalDrug(normalPage);
  assert.equal(normal.held, undefined);
  assert.ok(normal.payload);
  assert.equal(normal.payload.active_ingredient, 'Amoxicilina');
});
