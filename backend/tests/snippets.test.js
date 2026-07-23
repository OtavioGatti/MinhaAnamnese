const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_SNIPPET_BODY_LENGTH,
  mapOfficialSnippetRow,
  normalizeOfficialSnippetPayload,
  normalizeSlug,
  normalizeStatus,
} = require('../services/officialSnippets');
const { mapNotionPageToSnippet } = require('../services/notionSnippetSync');

test('normalizeOfficialSnippetPayload aceita frase completa e normaliza campos', () => {
  const { payload, error } = normalizeOfficialSnippetPayload({
    slug: 'Exame Físico Normal — Feminino',
    name: '  Exame físico normal — feminino ',
    status: 'Published',
    category: 'Geral',
    snippetType: 'Exame físico',
    displayOrder: 10,
    body: 'EXAME FÍSICO\r\nBEG, CORADA, HIDRATADA...\r\nAP: MV+ BILAT. S/RA',
    notionPageId: 'abc-123',
  });

  assert.equal(error, null);
  assert.equal(payload.slug, 'exame_fisico_normal_feminino');
  assert.equal(payload.name, 'Exame físico normal — feminino');
  assert.equal(payload.status, 'published');
  assert.equal(payload.snippet_type, 'Exame físico');
  assert.equal(payload.display_order, 10);
  // CRLF vira LF e as quebras internas são preservadas (é texto para colar).
  assert.equal(payload.body, 'EXAME FÍSICO\nBEG, CORADA, HIDRATADA...\nAP: MV+ BILAT. S/RA');
});

test('normalizeOfficialSnippetPayload rejeita sem slug/nome/corpo com razões', () => {
  const { payload, error } = normalizeOfficialSnippetPayload({
    slug: '',
    name: '',
    body: '   ',
    status: 'Published',
  });

  assert.equal(payload, null);
  assert.deepEqual(error.reasons, ['missing_slug', 'missing_name', 'missing_body']);
});

test('body é truncado no limite máximo', () => {
  const { payload } = normalizeOfficialSnippetPayload({
    slug: 'grande',
    name: 'Grande',
    status: 'published',
    body: 'x'.repeat(MAX_SNIPPET_BODY_LENGTH + 500),
  });

  assert.equal(payload.body.length, MAX_SNIPPET_BODY_LENGTH);
});

test('normalizeStatus e normalizeSlug seguem o padrão das outras tabelas', () => {
  assert.equal(normalizeStatus('Publicado'), 'published');
  assert.equal(normalizeStatus('Archived'), 'archived');
  assert.equal(normalizeStatus('qualquer'), 'draft');
  assert.equal(normalizeSlug('Orientação de Alta — Dengue'), 'orientacao_de_alta_dengue');
});

test('mapOfficialSnippetRow ignora linhas sem corpo e mapeia as válidas', () => {
  assert.equal(mapOfficialSnippetRow({ slug: 's', name: 'N', body: '  ' }), null);

  const mapped = mapOfficialSnippetRow({
    slug: 'exame_fisico_normal_masculino',
    name: 'Exame físico normal — masculino',
    category: 'Geral',
    category_key: 'geral',
    snippet_type: 'Exame físico',
    body: 'EXAME FÍSICO\nBEG...',
    display_order: 20,
  });

  assert.equal(mapped.id, 'exame_fisico_normal_masculino');
  assert.equal(mapped.title, 'Exame físico normal — masculino');
  assert.equal(mapped.source, 'official');
  assert.equal(mapped.body, 'EXAME FÍSICO\nBEG...');
});

test('mapNotionPageToSnippet lê as propriedades da tabela Frases Prontas', () => {
  const snippet = mapNotionPageToSnippet({
    id: 'page-1',
    last_edited_time: '2026-07-13T00:00:00.000Z',
    properties: {
      Name: { title: [{ plain_text: 'Exame físico normal — feminino' }] },
      Slug: { rich_text: [{ plain_text: 'exame_fisico_normal_feminino' }] },
      Status: { type: 'select', select: { name: 'Published' } },
      Category: { type: 'select', select: { name: 'Geral' } },
      'Snippet type': { type: 'select', select: { name: 'Exame físico' } },
      Order: { number: 10 },
      Body: { rich_text: [{ plain_text: 'EXAME FÍSICO\nBEG, CORADA...' }] },
    },
  });

  assert.equal(snippet.slug, 'exame_fisico_normal_feminino');
  assert.equal(snippet.status, 'Published');
  assert.equal(snippet.snippetType, 'Exame físico');
  assert.equal(snippet.displayOrder, 10);
  assert.equal(snippet.body, 'EXAME FÍSICO\nBEG, CORADA...');
  assert.equal(snippet.sourceUpdatedAt, '2026-07-13T00:00:00.000Z');
});
