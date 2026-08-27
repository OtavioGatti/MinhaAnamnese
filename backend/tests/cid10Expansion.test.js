const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  clearCid10SynonymsCache,
  expandCid10Query,
  getCid10Synonyms,
  parseSynonyms,
} = require('../services/cid10SynonymDictionary');
const { MAX_TERMS, sanitizeTerms } = require('../services/cid10QueryExpansionAi');
const { looksLikeCodeSearch, mergeResults } = require('../services/cid10');

test('parseSynonyms normaliza chave e expansões', () => {
  const map = parseSynonyms(JSON.stringify([
    { termo: '  Pressão ALTA ', expandir_para: ['Hipertensão'] },
  ]));

  assert.deepEqual(map.get('pressao alta'), ['hipertensao'], 'acento e caixa saem dos dois lados');
});

test('parseSynonyms descarta entrada sem termo ou sem expansão', () => {
  const map = parseSynonyms(JSON.stringify([
    { termo: 'sem expansao', expandir_para: [] },
    { termo: '', expandir_para: ['alguma coisa'] },
    { termo: 'valida', expandir_para: ['destino'] },
  ]));

  assert.equal(map.size, 1);
  assert.deepEqual(map.get('valida'), ['destino']);
});

test('parseSynonyms remove expansão duplicada', () => {
  const map = parseSynonyms(JSON.stringify([
    { termo: 'itu', expandir_para: ['cistite', 'Cistite', 'cistite'] },
  ]));

  assert.deepEqual(map.get('itu'), ['cistite']);
});

test('expandCid10Query devolve o termo oficial e ignora quem não está no dicionário', () => {
  // A ordem importa: o primeiro termo é o mais provável, e é o que vai ocupar
  // o topo da lista ("pressão alta" precisa cair em I10, não em hipertensão portal).
  assert.deepEqual(expandCid10Query('pressão alta'), ['hipertensao essencial', 'hipertensao']);
  assert.deepEqual(
    expandCid10Query('PRESSAO ALTA'),
    ['hipertensao essencial', 'hipertensao'],
    'busca é insensível a caixa/acento',
  );
  assert.deepEqual(expandCid10Query('termo que nao existe no dicionario'), []);
  assert.deepEqual(expandCid10Query(''), []);
});

test('expandCid10Query casa termo inteiro, nunca por aproximação', () => {
  // "dor no peito" e "dor no pescoço" são condições diferentes: casar por
  // parecença aqui mandaria a busca para o CID errado.
  assert.deepEqual(expandCid10Query('pressao'), [], 'prefixo não basta');
  assert.deepEqual(expandCid10Query('pressao alta e baixa'), [], 'sobra de texto não basta');
});

test('dicionário versionado carrega e traz os termos-âncora', () => {
  clearCid10SynonymsCache();
  const map = getCid10Synonyms();

  assert.ok(map.size > 50, 'dicionário real foi carregado');
  assert.ok(map.has('drge'), 'siglas comuns estão cobertas');
  assert.ok(map.has('derrame'), 'termo leigo está coberto');
});

test('dicionário ausente não derruba a busca', () => {
  const missingPath = path.join(os.tmpdir(), 'cid10_synonyms_inexistente.json');
  const original = process.env.CID10_SYNONYMS_PATH;

  clearCid10SynonymsCache();
  process.env.CID10_SYNONYMS_PATH = missingPath;

  try {
    assert.deepEqual(expandCid10Query('pressao alta'), [], 'degrada para lista vazia, sem lançar');
  } finally {
    if (original === undefined) {
      delete process.env.CID10_SYNONYMS_PATH;
    } else {
      process.env.CID10_SYNONYMS_PATH = original;
    }
    clearCid10SynonymsCache();
  }
});

test('dicionário malformado não derruba a busca', () => {
  const badPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cid10-')), 'ruim.json');
  fs.writeFileSync(badPath, 'isto não é json', 'utf8');
  const original = process.env.CID10_SYNONYMS_PATH;

  clearCid10SynonymsCache();
  process.env.CID10_SYNONYMS_PATH = badPath;

  try {
    assert.deepEqual(expandCid10Query('pressao alta'), []);
  } finally {
    if (original === undefined) {
      delete process.env.CID10_SYNONYMS_PATH;
    } else {
      process.env.CID10_SYNONYMS_PATH = original;
    }
    clearCid10SynonymsCache();
  }
});

test('sanitizeTerms descarta qualquer termo com cara de código CID', () => {
  // O contrato de segurança é que a IA nunca escolhe o código: ela só sugere
  // como nomear a condição, e o código sai da tabela oficial.
  const terms = sanitizeTerms(['E78', 'E78.5', 'hiperlipidemia', 'covid 19'], 'dislipidemia');

  assert.deepEqual(terms, ['hiperlipidemia'], 'tudo que tem dígito é descartado');
});

test('sanitizeTerms normaliza, remove duplicata e o próprio termo original', () => {
  const terms = sanitizeTerms(['Hipertensão', 'hipertensao', 'PRESSAO ALTA'], 'pressao alta');

  assert.deepEqual(terms, ['hipertensao'], 'duplicata e eco do termo original saem');
});

test('sanitizeTerms respeita o teto e ignora entrada inválida', () => {
  const many = sanitizeTerms(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'], 'x');
  assert.equal(many.length, MAX_TERMS);

  assert.deepEqual(sanitizeTerms(null, 'x'), []);
  assert.deepEqual(sanitizeTerms(['ab', '  ', null], 'x'), [], 'termo curto demais não vira busca');
});

test('looksLikeCodeSearch separa busca por código de busca por termo', () => {
  assert.equal(looksLikeCodeSearch('n30'), true);
  assert.equal(looksLikeCodeSearch('E78.5'), true);
  assert.equal(looksLikeCodeSearch('dislipidemia'), false);
  assert.equal(looksLikeCodeSearch('pressao alta'), false);
});

test('mergeResults preserva a ordem do termo digitado e não repete código', () => {
  const base = [{ code: 'E78.5' }, { code: 'E78.2' }];
  const extra = [{ code: 'E78.2' }, { code: 'E78.4' }];

  assert.deepEqual(
    mergeResults(base, extra, 10).map((item) => item.code),
    ['E78.5', 'E78.2', 'E78.4'],
    'o resultado do termo original vem primeiro e a duplicata some',
  );
});

test('mergeResults respeita o limite pedido', () => {
  const base = [{ code: 'A' }, { code: 'B' }];
  const extra = [{ code: 'C' }, { code: 'D' }];

  assert.deepEqual(mergeResults(base, extra, 3).map((item) => item.code), ['A', 'B', 'C']);
  assert.deepEqual(mergeResults(base, extra, 2).map((item) => item.code), ['A', 'B']);
});
