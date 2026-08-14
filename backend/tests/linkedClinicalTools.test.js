const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { normalizeLinkedToolSlugs } = require('../services/officialTemplates');
const { mapNotionPageToTemplate } = require('../services/notionTemplateSync');

function buildNotionTemplatePage(linkedToolsText) {
  return {
    id: 'page-1',
    last_edited_time: '2026-08-13T00:00:00.000Z',
    properties: {
      Slug: { rich_text: [{ plain_text: 'pediatria_puericultura' }] },
      Name: { title: [{ plain_text: 'Pediatria - Puericultura e Rotina' }] },
      Status: { select: { name: 'Published' } },
      Category: { select: { name: 'Pediatria' } },
      Sections: { rich_text: [{ plain_text: 'Queixa principal\nHistória da doença atual' }] },
      ...(linkedToolsText == null
        ? {}
        : { 'Linked tools': { rich_text: [{ plain_text: linkedToolsText }] } }),
    },
  };
}

describe('ferramentas vinculadas ao modelo', () => {
  test('aceita uma por linha, com ou sem marcador de lista', () => {
    assert.deepEqual(
      normalizeLinkedToolSlugs('- calendario-vacinal-crianca\n- marcos-desenvolvimento-infantil'),
      ['calendario-vacinal-crianca', 'marcos-desenvolvimento-infantil'],
    );

    assert.deepEqual(
      normalizeLinkedToolSlugs('calendario-vacinal-crianca, marcos-desenvolvimento-infantil'),
      ['calendario-vacinal-crianca', 'marcos-desenvolvimento-infantil'],
    );
  });

  test('preserva o hífen do slug de ferramenta e normaliza o resto', () => {
    assert.deepEqual(
      normalizeLinkedToolSlugs(['  Calendário Vacinal da Criança  ']),
      ['calendario-vacinal-da-crianca'],
    );
  });

  test('remove duplicatas e entradas vazias', () => {
    assert.deepEqual(
      normalizeLinkedToolSlugs('marcos-desenvolvimento-infantil\n\nmarcos-desenvolvimento-infantil\n   '),
      ['marcos-desenvolvimento-infantil'],
    );
  });

  test('degrada para lista vazia em valores ausentes', () => {
    assert.deepEqual(normalizeLinkedToolSlugs(null), []);
    assert.deepEqual(normalizeLinkedToolSlugs(undefined), []);
    assert.deepEqual(normalizeLinkedToolSlugs(''), []);
    assert.deepEqual(normalizeLinkedToolSlugs({}), []);
  });

  test('limita a quantidade de vínculos por modelo', () => {
    const many = Array.from({ length: 30 }, (_, index) => `ferramenta-${index}`);
    assert.equal(normalizeLinkedToolSlugs(many).length, 12);
  });
});

describe('sync do Notion para modelos oficiais', () => {
  test('lê a propriedade "Linked tools" para o metadata do modelo', () => {
    const template = mapNotionPageToTemplate(buildNotionTemplatePage(
      'calendario-vacinal-crianca\nmarcos-desenvolvimento-infantil',
    ));

    assert.deepEqual(template.metadata.linkedTools, [
      'calendario-vacinal-crianca',
      'marcos-desenvolvimento-infantil',
    ]);
  });

  // O sync inteiro dos modelos quebra se o mapeamento lançar aqui, mesmo para
  // as bases que ainda não têm a propriedade.
  test('modelo sem a propriedade continua mapeando', () => {
    const template = mapNotionPageToTemplate(buildNotionTemplatePage(null));

    assert.deepEqual(template.metadata.linkedTools, []);
    assert.equal(template.slug, 'pediatria_puericultura');
    assert.equal(template.status, 'Published');
  });
});
