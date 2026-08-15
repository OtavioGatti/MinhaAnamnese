const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildAliasKeys,
  buildCatalogSearchName,
  findExactAliasMatch,
  normalizeMatchKey,
} = require('../utils/clinicalAliasMatching');
const {
  buildManeuverAliasKeys,
  buildManeuverRef,
  mapManeuverRow,
} = require('../services/physicalExamManeuvers');
const { collectUnmatchedManeuvers } = require('../services/unmatchedManeuvers');
const {
  buildSearchText,
  normalizeManeuverPayload,
  normalizeReviewStatus,
  normalizeSlug,
  normalizeStatus,
} = require('../services/notionPhysicalExamManeuversSync');
const { buildManeuverCatalogReference } = require('../prompts/diagnosticHypothesesPrompt');
const { normalizeDiagnosticHypotheses } = require('../contracts/diagnosticHypotheses');

const MANEUVERS = [
  { slug: 'sinal-de-giordano', name: 'Sinal de Giordano', aliases: 'Punho-percussão lombar' },
  { slug: 'teste-da-gaveta-anterior', name: 'Teste da gaveta anterior', aliases: '' },
];

test('normalizeMatchKey ignora acento, caixa e pontuação', () => {
  assert.equal(normalizeMatchKey('Sinal de Giordano'), 'sinal de giordano');
  assert.equal(normalizeMatchKey('SINAL DE GIORDANO'), 'sinal de giordano');
  assert.equal(normalizeMatchKey('Punho-percussão  lombar'), 'punho percussao lombar');
});

test('buildAliasKeys quebra sinônimos separados por barra', () => {
  const keys = buildAliasKeys(['Sinusite Aguda / Rinossinusite Aguda Bacteriana']);

  assert.ok(keys.has('sinusite aguda'));
  assert.ok(keys.has('rinossinusite aguda bacteriana'));
  assert.ok(keys.has('sinusite aguda rinossinusite aguda bacteriana'), 'o título composto também vale');
});

test('buildCatalogSearchName remove a sigla final', () => {
  assert.equal(buildCatalogSearchName('Pneumonia Adquirida na Comunidade (PAC)'), 'Pneumonia Adquirida na Comunidade');
  assert.equal(buildCatalogSearchName('Sinal de Giordano'), 'Sinal de Giordano');
  assert.equal(buildCatalogSearchName('(PAC)'), '(PAC)', 'só a sigla: não sobra nada para buscar, devolve como veio');
});

test('manobra casa pelo nome e pelo sinônimo, nunca por substring', () => {
  const byName = findExactAliasMatch('Sinal de Giordano', MANEUVERS, buildManeuverAliasKeys);
  assert.equal(byName?.slug, 'sinal-de-giordano');

  const byAlias = findExactAliasMatch('Punho-percussão lombar', MANEUVERS, buildManeuverAliasKeys);
  assert.equal(byAlias?.slug, 'sinal-de-giordano', 'o sinônimo aponta para a mesma manobra');

  assert.equal(
    findExactAliasMatch('Giordano', MANEUVERS, buildManeuverAliasKeys),
    null,
    'nome parcial não casa: traria a manobra errada em outro contexto',
  );
  assert.equal(findExactAliasMatch('Teste da gaveta', MANEUVERS, buildManeuverAliasKeys), null);
});

test('buildManeuverRef expõe só o conteúdo revisado, sem campos internos', () => {
  const ref = buildManeuverRef({
    slug: 'sinal-de-giordano',
    name: 'Sinal de Giordano',
    category: 'Geniturinário',
    howToPerform: 'Punho-percussão na loja renal.',
    positiveFinding: 'Dor sugere acometimento renal.',
    reviewStatus: 'Validado',
    displayOrder: 10,
  });

  assert.equal(ref.slug, 'sinal-de-giordano');
  assert.equal(ref.howToPerform, 'Punho-percussão na loja renal.');
  assert.ok(!('reviewStatus' in ref), 'metadado editorial não vai para o cliente');
  assert.ok(!('displayOrder' in ref), 'ordenação não vai para o cliente');
  assert.equal(buildManeuverRef(null), null);
  assert.equal(buildManeuverRef({ name: 'sem slug' }), null);
});

test('mapManeuverRow ignora linha sem slug ou nome', () => {
  assert.equal(mapManeuverRow({ slug: 'x' }), null);
  assert.equal(mapManeuverRow({ name: 'y' }), null);
  assert.equal(mapManeuverRow({ slug: 'x', name: 'Manobra' })?.name, 'Manobra');
});

test('contrato aceita suggestedExamManeuvers e deduplica', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [{
      name: 'Pielonefrite',
      suggestedExamManeuvers: ['Sinal de Giordano', 'sinal de giordano', '', 'Punho-percussão lombar'],
    }],
  });

  assert.deepEqual(
    result.hypotheses[0].suggestedExamManeuvers,
    ['Sinal de Giordano', 'Punho-percussão lombar'],
  );
});

test('hipótese sem manobra sugerida devolve lista vazia, não undefined', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [{ name: 'Cistite' }],
  });

  assert.deepEqual(result.hypotheses[0].suggestedExamManeuvers, []);
});

test('backlog junta só as manobras sem correspondência no catálogo', () => {
  const entries = collectUnmatchedManeuvers([
    {
      name: 'Pielonefrite',
      examManeuvers: [
        { name: 'Sinal de Giordano', maneuver: { slug: 'sinal-de-giordano' } },
        { name: 'Manobra Inexistente', maneuver: null },
      ],
    },
    {
      name: 'Outra',
      examManeuvers: [
        { name: 'manobra inexistente', maneuver: null },
        { name: 'Nova Manobra', maneuver: null },
      ],
    },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.displayName),
    ['Manobra Inexistente', 'Nova Manobra'],
    'a casada fica fora e a repetida entra uma vez só',
  );
});

test('referência do catálogo no prompt é opcional e marcada como não-instrução', () => {
  assert.equal(buildManeuverCatalogReference([]), '', 'catálogo vazio não polui o prompt');
  assert.equal(buildManeuverCatalogReference(null), '');

  const reference = buildManeuverCatalogReference(['Sinal de Giordano', 'Teste da gaveta anterior']);

  assert.ok(reference.includes('NÃO É INSTRUÇÃO'), 'entra como dado, não como comando');
  assert.ok(reference.includes('não esteja na lista'), 'a lista não é fechada: nomear fora dela é permitido');
  assert.ok(reference.includes('Sinal de Giordano'));
});

test('sync normaliza slug, status e rótulo de revisão', () => {
  assert.equal(normalizeSlug('Sinal de Giordano'), 'sinal-de-giordano');
  assert.equal(normalizeStatus('Published'), 'published');
  assert.equal(normalizeStatus(''), 'draft');
  assert.equal(normalizeReviewStatus('Validado'), 'Validado');
  assert.equal(
    normalizeReviewStatus('Não usar sem validação'),
    'Não usar sem validação',
    'precisa bater exatamente com o valor que o backend usa para esconder',
  );
  assert.equal(normalizeReviewStatus(''), 'Revisão pendente');
});

test('search_text do sync sai sem acento, para a busca não depender de unaccent', () => {
  const text = buildSearchText({
    name: 'Sinal de Giordano',
    aliases: 'Punho-percussão lombar',
    category: 'Geniturinário',
    relatedConditions: 'Pielonefrite',
  });

  assert.ok(text.includes('punho-percussao lombar'));
  assert.ok(text.includes('geniturinario'));
  assert.equal(text, text.toLowerCase());
});

test('normalizeManeuverPayload deriva slug do nome e recusa entrada vazia', () => {
  const ok = normalizeManeuverPayload({
    name: 'Sinal de Giordano',
    status: 'Published',
    reviewStatus: 'Validado',
    howToPerform: 'Punho-percussão na loja renal.',
  });

  assert.equal(ok.error, null);
  assert.equal(ok.payload.slug, 'sinal-de-giordano', 'sem Slug preenchido, deriva do nome');
  assert.equal(ok.payload.status, 'published');
  assert.equal(ok.payload.active, true);

  const bad = normalizeManeuverPayload({ name: '' });
  assert.equal(bad.payload, null);
  assert.deepEqual(bad.error.reasons, ['missing_name', 'missing_slug']);
});
