const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MIN_QUERY_LENGTH,
  buildCodeKeyQuery,
  mapCid10Row,
  normalizeQuery,
  rankCid10Results,
  searchCid10Codes,
} = require('../services/cid10');

test('normalizeQuery remove acento e caracteres que quebrariam o filtro do PostgREST', () => {
  assert.equal(normalizeQuery('Infecção'), 'Infeccao');
  assert.equal(normalizeQuery('cistite, aguda'), 'cistite aguda');
  assert.equal(normalizeQuery('a(b),c'), 'a b c');
  assert.equal(normalizeQuery('  N30.0  '), 'N30.0', 'ponto é preservado: faz parte do código');
  assert.equal(normalizeQuery('x'.repeat(200)).length, 80);
});

test('buildCodeKeyQuery trata "n30.0" e "n300" como o mesmo código', () => {
  assert.equal(buildCodeKeyQuery('n30.0'), 'N300');
  assert.equal(buildCodeKeyQuery('n300'), 'N300');
  assert.equal(buildCodeKeyQuery('N30'), 'N30');
});

test('mapCid10Row ignora linha sem código ou descrição', () => {
  assert.equal(mapCid10Row({ code: 'N30.0' }), null);
  assert.equal(mapCid10Row({ description: 'Cistite aguda' }), null);

  const mapped = mapCid10Row({
    code: 'N30.0',
    description: 'Cistite aguda',
    category_code: 'N30',
    chapter_number: 14,
    level: 'subcategoria',
    dagger_asterisk: '*',
  });

  assert.equal(mapped.code, 'N30.0');
  assert.equal(mapped.categoryCode, 'N30');
  assert.equal(mapped.chapterNumber, 14);
  assert.equal(mapped.daggerAsterisk, '*');
});

test('rankCid10Results prioriza código exato, depois prefixo, depois o termo', () => {
  const results = [
    { code: 'N30.8', description: 'Outras cistites' },
    { code: 'N30.0', description: 'Cistite aguda' },
    { code: 'A01.0', description: 'Febre tifoide' },
  ];

  const byCode = rankCid10Results(results, 'N30.0');
  assert.equal(byCode[0].code, 'N30.0', 'código exato vem primeiro');

  const byPrefix = rankCid10Results(results, 'N30');
  assert.ok(['N30.8', 'N30.0'].includes(byPrefix[0].code), 'prefixo de código antes do resto');
  assert.equal(byPrefix[2].code, 'A01.0', 'quem não casa com o prefixo fica por último');

  const byTerm = rankCid10Results(results, 'cistite');
  assert.equal(byTerm[0].code, 'N30.0', '"Cistite aguda" começa com o termo, "Outras cistites" não');
});

test('rankCid10Results é estável para itens de mesma pontuação', () => {
  const results = [
    { code: 'J06.9', description: 'Infeccao aguda das vias aereas' },
    { code: 'J00', description: 'Nasofaringite aguda' },
  ];

  const ranked = rankCid10Results(results, 'aguda');
  assert.deepEqual(ranked.map((item) => item.code), ['J06.9', 'J00'], 'mantém a ordem original');
});

test('searchCid10Codes não vai à rede com busca curta demais', async () => {
  assert.deepEqual(await searchCid10Codes({ query: 'a' }), []);
  assert.deepEqual(await searchCid10Codes({ query: '' }), []);
  assert.ok(MIN_QUERY_LENGTH >= 2, 'uma letra sozinha traria ruído demais');
});
