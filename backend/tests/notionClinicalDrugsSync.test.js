const assert = require('node:assert/strict');
const test = require('node:test');
const { mapNotionPageToClinicalDrug } = require('../services/notionClinicalDrugsSync');

function buildPage({ activeIngredient = 'Amoxicilina', publicationStatus } = {}) {
  const properties = {
    'Princípio Ativo': { title: [{ plain_text: activeIngredient, text: { content: activeIngredient } }] },
  };

  if (publicationStatus !== undefined) {
    properties['Status Publicação'] = { type: 'select', select: { name: publicationStatus } };
  }

  return { id: 'page-id', properties };
}

function mapDrug(options) {
  const mapped = mapNotionPageToClinicalDrug(buildPage(options));
  assert.equal(mapped.error, null, `mapeamento falhou: ${JSON.stringify(mapped.error)}`);
  return mapped.payload;
}

test('publication_status é PUBLICADO por padrão quando a propriedade não existe (caso real hoje)', () => {
  assert.equal(mapDrug({}).publication_status, 'published'); // sem 'Status Publicação' nas properties
});

test('publication_status é PUBLICADO por padrão quando a propriedade está vazia', () => {
  assert.equal(mapDrug({ publicationStatus: '' }).publication_status, 'published');
});

test('publication_status vira draft só quando explicitamente "Draft"/"Rascunho"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Draft' }).publication_status, 'draft');
  assert.equal(mapDrug({ publicationStatus: 'Rascunho' }).publication_status, 'draft');
});

test('publication_status vira archived quando explicitamente "Archived"/"Arquivado"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Archived' }).publication_status, 'archived');
  assert.equal(mapDrug({ publicationStatus: 'Arquivado' }).publication_status, 'archived');
});

test('publication_status continua published quando explicitamente "Publicado"', () => {
  assert.equal(mapDrug({ publicationStatus: 'Publicado' }).publication_status, 'published');
});
