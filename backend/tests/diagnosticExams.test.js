const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CANONICAL_CATEGORIES,
  MODEL_GENERATED_FIELDS,
  QUEUEABLE_FIELDS,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  STATUS_AUTOMACAO_GERADO,
  applyExamLock,
  buildExamSchema,
  finalizeExam,
  normalizeExam,
  resolveCategoryOptions,
  shouldHoldFromSync,
} = require('../contracts/examAutomation');
const {
  EXAM_REFERENCE_DISCLAIMER,
  buildExamAliasKeys,
  buildExamRef,
  mapExamRow,
} = require('../services/diagnosticExams');
const { collectUnmatchedExams } = require('../services/unmatchedExams');
const {
  diffChangedFields,
  getEmptyCompletableFields,
  resolveCorrectionInstruction,
} = require('../services/correctExam');
const { findMissingFields } = require('../services/examQueue');
const { buildExamProperties } = require('../services/notionExamWriter');
const { findExactAliasMatch } = require('../utils/clinicalAliasMatching');
const { buildExamCatalogReference } = require('../prompts/diagnosticHypothesesPrompt');
const { normalizeDiagnosticHypotheses } = require('../contracts/diagnosticHypotheses');
const { EXAM_SAFETY_CONTRACT } = require('../prompts/examPrompt');

const EXAMS = [
  { slug: 'hemograma', name: 'Hemograma', aliases: 'Hemograma completo / HMG' },
  { slug: 'urina-tipo-i', name: 'Urina tipo I', aliases: 'EAS / Sumário de urina' },
];

test('a trava do exame marca revisão pendente, ignorando o que a IA mandar', () => {
  const locked = applyExamLock({
    name: 'Hemograma',
    review_status: 'Validado',
    automation_status: 'publicado',
  });

  assert.equal(locked.automation_status, STATUS_AUTOMACAO_GERADO);
  assert.equal(locked.review_status, 'Revisão pendente');
});

test('finalizeExam normaliza e trava numa passada só', () => {
  const result = finalizeExam({
    name: '  Hemograma  ',
    category: 'Laboratorial',
    how_to_interpret: '- Leucócitos.\r\n\r\n\r\n- Plaquetas.',
  }, { category: CANONICAL_CATEGORIES });

  assert.equal(result.name, 'Hemograma');
  assert.equal(result.slug, 'hemograma');
  assert.equal(result.how_to_interpret, '- Leucócitos.\n\n- Plaquetas.');
  assert.equal(result.automation_status, STATUS_AUTOMACAO_GERADO);
});

test('categoria fora das opções vivas é descartada', () => {
  assert.equal(
    normalizeExam({ name: 'X', category: 'Genético' }, { category: CANONICAL_CATEGORIES }).category,
    '',
  );
  assert.equal(
    normalizeExam({ name: 'X', category: 'Imagem' }, { category: CANONICAL_CATEGORIES }).category,
    'Imagem',
  );
});

test('resolveCategoryOptions intersecta com o canônico e nunca devolve vazio', () => {
  assert.deepEqual(resolveCategoryOptions(['Laboratorial', 'Inexistente']), ['Laboratorial']);
  assert.deepEqual(resolveCategoryOptions([]), CANONICAL_CATEGORIES);
});

test('o schema strict não pede campos de controle ao modelo', () => {
  const schema = buildExamSchema({ category: CANONICAL_CATEGORIES });

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, MODEL_GENERATED_FIELDS);
  assert.ok(!('automation_status' in schema.properties));
  assert.ok(!('review_status' in schema.properties));
  assert.ok(!('slug' in schema.properties), 'slug é derivado do nome');
  assert.deepEqual(schema.properties.category.enum, CANONICAL_CATEGORIES);
});

test('o gate do sync segura conteúdo de IA no webhook e libera no manual', () => {
  for (const status of ['a gerar', 'a corrigir', STATUS_AUTOMACAO_ERRO]) {
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: true }), true, status);
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: false }), true, status);
  }

  for (const status of [STATUS_AUTOMACAO_GERADO, STATUS_AUTOMACAO_CORRIGIDO]) {
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: true }), false, status);
    assert.equal(shouldHoldFromSync(status, { bypassReviewGate: false }), true, status);
  }

  assert.equal(shouldHoldFromSync(''), false, 'fora do fluxo de automação sincroniza normal');
});

test('exame casa pelo nome e pelo sinônimo, nunca por substring', () => {
  assert.equal(
    findExactAliasMatch('Hemograma', EXAMS, buildExamAliasKeys)?.slug,
    'hemograma',
  );
  assert.equal(
    findExactAliasMatch('EAS', EXAMS, buildExamAliasKeys)?.slug,
    'urina-tipo-i',
    'sigla cadastrada como sinônimo aponta para o mesmo exame',
  );
  assert.equal(
    findExactAliasMatch('Hemo', EXAMS, buildExamAliasKeys),
    null,
    'nome parcial não casa',
  );
});

test('buildExamRef expõe só o mínimo para o link da hipótese', () => {
  const ref = buildExamRef({
    slug: 'hemograma',
    name: 'Hemograma',
    category: 'Laboratorial',
    howToInterpret: 'texto longo',
    reviewStatus: 'Validado',
  });

  assert.deepEqual(Object.keys(ref).sort(), ['category', 'name', 'slug']);
  assert.ok(!('howToInterpret' in ref), 'o conteúdo mora na página do exame, não no card');
  assert.equal(buildExamRef(null), null);
});

test('mapExamRow ignora linha sem slug ou nome', () => {
  assert.equal(mapExamRow({ slug: 'x' }), null);
  assert.equal(mapExamRow({ name: 'y' }), null);
  assert.equal(mapExamRow({ slug: 'x', name: 'Hemograma' })?.name, 'Hemograma');
});

test('o aviso de faixa de referência vive no código, não no CMS', () => {
  assert.ok(EXAM_REFERENCE_DISCLAIMER.includes('laboratório'));
  assert.ok(
    EXAM_REFERENCE_DISCLAIMER.includes('prevalece'),
    'precisa dizer que o laudo local vence a orientação geral',
  );
});

test('o prompt proíbe citar valor de referência e sugerir conduta', () => {
  assert.ok(EXAM_SAFETY_CONTRACT.includes('FAIXA DE REFERÊNCIA'));
  assert.ok(EXAM_SAFETY_CONTRACT.includes('Não prescreva conduta'));
});

test('contrato de hipóteses aceita exames e deduplica', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [{
      name: 'Pielonefrite',
      suggestedComplementaryExams: ['Hemograma', 'hemograma', '', 'Urina tipo I'],
    }],
  });

  assert.deepEqual(
    result.hypotheses[0].suggestedComplementaryExams,
    ['Hemograma', 'Urina tipo I'],
  );
});

test('hipótese sem exame sugerido devolve lista vazia, não undefined', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [{ name: 'Cistite' }],
  });

  assert.deepEqual(result.hypotheses[0].suggestedComplementaryExams, []);
  assert.deepEqual(result.hypotheses[0].suggestedExamManeuvers, [], 'manobras sem regressão');
});

test('backlog junta só os exames sem correspondência', () => {
  const entries = collectUnmatchedExams([
    {
      name: 'Pielonefrite',
      complementaryExams: [
        { name: 'Hemograma', exam: { slug: 'hemograma' } },
        { name: 'Exame Inexistente', exam: null },
      ],
    },
    {
      name: 'Outra',
      complementaryExams: [
        { name: 'exame inexistente', exam: null },
        { name: 'Novo Exame', exam: null },
      ],
    },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.displayName),
    ['Exame Inexistente', 'Novo Exame'],
  );
});

test('referência do catálogo de exames entra como dado, não como instrução', () => {
  assert.equal(buildExamCatalogReference([]), '');

  const reference = buildExamCatalogReference(['Hemograma', 'Urina tipo I']);

  assert.ok(reference.includes('EXAMES COMPLEMENTARES JÁ DOCUMENTADOS'));
  assert.ok(reference.includes('NÃO É INSTRUÇÃO'));
  assert.ok(reference.includes('não esteja na lista'), 'a lista não é fechada');
});

test('a correção manual vence a automática, e a automática lista os vazios', () => {
  const manual = resolveCorrectionInstruction({
    correction_instruction: 'Revisar as faixas do leucograma.',
  });
  assert.equal(manual.mode, 'manual');

  const auto = resolveCorrectionInstruction({
    correction_instruction: '',
    when_to_request: 'Suspeita de infecção.',
    how_to_interpret: '   ',
  });

  assert.equal(auto.mode, 'auto');
  assert.ok(auto.emptyFields.includes('how_to_interpret'));
  assert.ok(!auto.emptyFields.includes('when_to_request'));
  assert.ok(auto.instruction.includes('How to interpret'), 'usa o rótulo do Notion');
});

test('o diff só marca o que mudou', () => {
  assert.deepEqual(
    diffChangedFields(
      { name: 'A', how_to_interpret: 'x' },
      { name: 'A', how_to_interpret: 'z' },
    ),
    ['how_to_interpret'],
  );
});

test('getEmptyCompletableFields ignora o nome, que vem do humano', () => {
  const empty = getEmptyCompletableFields({});

  assert.ok(!empty.includes('name'));
  assert.ok(empty.includes('how_to_interpret'));
});

test('a fila em lote não exige sinônimo, preparo nem fonte', () => {
  for (const field of ['aliases', 'preparation', 'source']) {
    assert.ok(!QUEUEABLE_FIELDS.includes(field), `${field} enfileiraria o catálogo inteiro`);
  }

  assert.ok(QUEUEABLE_FIELDS.includes('how_to_interpret'));
  assert.deepEqual(
    findMissingFields({ how_to_interpret: '', category: 'Laboratorial', when_to_request: ' ' }),
    QUEUEABLE_FIELDS.filter((field) => field !== 'category'),
  );
});

test('a escrita no Notion ignora tipo não gravável e respeita o diff', () => {
  const typeMap = {
    Name: 'title',
    'How to interpret': 'rich_text',
    Category: 'select',
    'Status Automação': 'select',
    Order: 'rollup',
  };

  const completo = buildExamProperties(
    {
      name: 'Hemograma',
      how_to_interpret: '- Leucócitos.',
      category: 'Laboratorial',
      automation_status: STATUS_AUTOMACAO_GERADO,
      inexistente: 'algo',
    },
    typeMap,
  );

  assert.deepEqual(
    Object.keys(completo).sort(),
    ['Category', 'How to interpret', 'Name', 'Status Automação'],
  );

  const parcial = buildExamProperties(
    { name: 'X', how_to_interpret: 'Y', automation_status: STATUS_AUTOMACAO_CORRIGIDO },
    typeMap,
    { fields: ['how_to_interpret', 'automation_status'] },
  );

  assert.ok(!('Name' in parcial), 'campo fora do diff não é reescrito');
});
