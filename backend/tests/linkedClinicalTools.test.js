const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { normalizeLinkedToolSlugs } = require('../services/officialTemplates');

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
