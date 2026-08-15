const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CANONICAL_CATEGORIES,
  MODEL_GENERATED_FIELDS,
  QUEUEABLE_FIELDS,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  STATUS_AUTOMACAO_GERADO,
  applyManeuverLock,
  buildManeuverSchema,
  finalizeManeuver,
  normalizeManeuver,
  normalizeSlug,
  resolveCategoryOptions,
  shouldHoldFromSync,
} = require('../contracts/maneuverAutomation');
const {
  diffChangedFields,
  getEmptyCompletableFields,
  resolveCorrectionInstruction,
} = require('../services/correctManeuver');
const { findMissingFields } = require('../services/maneuverQueue');
const { buildManeuverProperties } = require('../services/notionManeuverWriter');

test('a trava marca revisão pendente e o status de automação, ignorando o que a IA mandar', () => {
  const locked = applyManeuverLock({
    name: 'Sinal de Giordano',
    review_status: 'Validado',
    automation_status: 'publicado',
  });

  assert.equal(locked.automation_status, STATUS_AUTOMACAO_GERADO);
  assert.equal(locked.review_status, 'Revisão pendente', 'a IA nunca marca como validado');
});

test('finalizeManeuver normaliza e trava numa passada só', () => {
  const result = finalizeManeuver({
    name: '  Sinal de Giordano  ',
    category: 'Geniturinário',
    how_to_perform: 'Passo 1.\r\n\r\n\r\nPasso 2.',
  }, { category: CANONICAL_CATEGORIES });

  assert.equal(result.name, 'Sinal de Giordano');
  assert.equal(result.slug, 'sinal-de-giordano', 'slug derivado do nome');
  assert.equal(result.how_to_perform, 'Passo 1.\n\nPasso 2.', 'quebras excessivas colapsadas');
  assert.equal(result.automation_status, STATUS_AUTOMACAO_GERADO);
});

test('categoria fora das opções vivas é descartada, não inventada', () => {
  const result = normalizeManeuver(
    { name: 'X', category: 'Dermatológico' },
    { category: CANONICAL_CATEGORIES },
  );

  assert.equal(result.category, '', 'valor fora do enum vira vazio');

  const ok = normalizeManeuver(
    { name: 'X', category: 'Ortopédico' },
    { category: CANONICAL_CATEGORIES },
  );

  assert.equal(ok.category, 'Ortopédico');
});

test('resolveCategoryOptions intersecta com o canônico e nunca devolve vazio', () => {
  assert.deepEqual(resolveCategoryOptions(['Abdominal', 'Inexistente']), ['Abdominal']);
  assert.deepEqual(resolveCategoryOptions([]), CANONICAL_CATEGORIES, 'sem opções vivas, cai no canônico');
  assert.deepEqual(resolveCategoryOptions(null), CANONICAL_CATEGORIES);
});

test('o schema strict exige todos os campos gerados e fecha para extras', () => {
  const schema = buildManeuverSchema({ category: CANONICAL_CATEGORIES });

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, MODEL_GENERATED_FIELDS);
  assert.deepEqual(schema.properties.category.enum, CANONICAL_CATEGORIES);
  assert.ok(!('automation_status' in schema.properties), 'controle não é pedido ao modelo');
  assert.ok(!('review_status' in schema.properties), 'a IA não decide a revisão');
  assert.ok(!('slug' in schema.properties), 'slug é derivado do nome');
});

test('o gate do sync segura o que a IA acabou de escrever, e o manual libera', () => {
  // Estados que nunca publicam, mesmo no sync manual.
  for (const status of ['a gerar', 'a corrigir', STATUS_AUTOMACAO_ERRO]) {
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: true }), true, status);
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: false }), true, status);
  }

  // Pronto para revisão: o humano clicando publica; o webhook segura.
  for (const status of [STATUS_AUTOMACAO_GERADO, STATUS_AUTOMACAO_CORRIGIDO]) {
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: true }), false, status);
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: false }), true, status);
  }

  // Página fora do fluxo de automação sincroniza normalmente.
  assert.equal(shouldHoldFromSync(''), false);
  assert.equal(shouldHoldFromSync(null), false);
});

test('a instrução de correção manual vence a detecção automática', () => {
  const manual = resolveCorrectionInstruction({
    correction_instruction: 'Trocar a descrição da posição do paciente.',
    how_to_perform: '',
  });

  assert.equal(manual.mode, 'manual');
  assert.equal(manual.instruction, 'Trocar a descrição da posição do paciente.');
  assert.deepEqual(manual.emptyFields, []);
});

test('sem instrução, a correção lista os campos vazios para completar', () => {
  const auto = resolveCorrectionInstruction({
    correction_instruction: '',
    category: 'Ortopédico',
    when_to_perform: 'Suspeita de lesão.',
    how_to_perform: '',
    positive_finding: '   ',
  });

  assert.equal(auto.mode, 'auto');
  assert.ok(auto.emptyFields.includes('how_to_perform'));
  assert.ok(auto.emptyFields.includes('positive_finding'), 'só espaço em branco conta como vazio');
  assert.ok(!auto.emptyFields.includes('when_to_perform'), 'campo preenchido fica de fora');
  assert.ok(auto.instruction.includes('How to perform'), 'usa o rótulo do Notion na instrução');
});

test('nada vazio e sem instrução: não há o que corrigir', () => {
  const nothing = resolveCorrectionInstruction(
    Object.fromEntries(MODEL_GENERATED_FIELDS.map((field) => [field, 'preenchido'])),
  );

  assert.equal(nothing.instruction, '', 'quem chama transforma isso em erro 400');
});

test('o diff só marca o que realmente mudou', () => {
  const current = { name: 'A', how_to_perform: 'x', positive_finding: 'y' };
  const next = { name: 'A', how_to_perform: 'z', positive_finding: 'y' };

  assert.deepEqual(diffChangedFields(current, next), ['how_to_perform']);
});

test('getEmptyCompletableFields ignora campos que o modelo não preenche', () => {
  const empty = getEmptyCompletableFields({});

  assert.ok(!empty.includes('name'), 'o nome vem do humano, não entra em auto-completar');
  assert.ok(empty.includes('how_to_perform'));
});

test('a fila em lote não exige sinônimo nem fonte', () => {
  assert.ok(!QUEUEABLE_FIELDS.includes('aliases'), 'nem toda manobra tem sinônimo consagrado');
  assert.ok(!QUEUEABLE_FIELDS.includes('source'), 'exigir fonte enfileiraria o catálogo inteiro');
  assert.ok(QUEUEABLE_FIELDS.includes('how_to_perform'));

  assert.deepEqual(
    findMissingFields({ how_to_perform: '', category: 'Ortopédico', when_to_perform: '  ' }),
    QUEUEABLE_FIELDS.filter((field) => field !== 'category'),
  );
});

test('a escrita no Notion ignora propriedade inexistente e tipo não gravável', () => {
  const typeMap = {
    Name: 'title',
    'How to perform': 'rich_text',
    Category: 'select',
    'Status Automação': 'select',
    Order: 'rollup', // tipo não gravável
  };

  const properties = buildManeuverProperties(
    {
      name: 'Sinal de Giordano',
      how_to_perform: 'Percussão lombar.',
      category: 'Geniturinário',
      automation_status: STATUS_AUTOMACAO_GERADO,
      inexistente: 'algo',
    },
    typeMap,
  );

  assert.deepEqual(
    Object.keys(properties).sort(),
    ['Category', 'How to perform', 'Name', 'Status Automação'],
  );
  assert.equal(properties.Name.title[0].text.content, 'Sinal de Giordano');
  assert.equal(properties['Status Automação'].select.name, STATUS_AUTOMACAO_GERADO);
});

test('a escrita respeita a lista de campos do diff', () => {
  const typeMap = { Name: 'title', 'How to perform': 'rich_text', 'Status Automação': 'select' };

  const properties = buildManeuverProperties(
    { name: 'X', how_to_perform: 'Y', automation_status: STATUS_AUTOMACAO_CORRIGIDO },
    typeMap,
    { fields: ['how_to_perform', 'automation_status'] },
  );

  assert.deepEqual(Object.keys(properties).sort(), ['How to perform', 'Status Automação']);
  assert.ok(!('Name' in properties), 'campo fora do diff não é reescrito');
});

test('normalizeSlug produz identificador estável', () => {
  assert.equal(normalizeSlug('Sinal de Giordano'), 'sinal-de-giordano');
  assert.equal(normalizeSlug('Punho-percussão  lombar'), 'punho-percussao-lombar');
  assert.equal(normalizeSlug(''), '');
});
