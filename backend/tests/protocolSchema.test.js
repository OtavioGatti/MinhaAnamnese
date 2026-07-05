const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildProtocolSchema,
  normalizeProtocol,
  MODEL_GENERATED_FIELDS,
} = require('../contracts/protocolAutomation');

const OPTIONS = {
  especialidade: ['Cardiologia', 'Clínica Médica'],
  contexto: ['Atenção Primária'],
  tipo_protocolo: ['Tratamento', 'Diagnóstico'],
  nivel_risco: ['Baixo', 'Moderado', 'Alto'],
};

test('schema strict: additionalProperties false e required cobre todas as chaves', () => {
  const schema = buildProtocolSchema(OPTIONS);

  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);

  const requiredSet = new Set(schema.required);
  const propertyKeys = Object.keys(schema.properties);

  // Toda chave de MODEL_GENERATED_FIELDS deve estar em required e em properties.
  for (const field of MODEL_GENERATED_FIELDS) {
    assert.ok(requiredSet.has(field), `campo ausente em required: ${field}`);
    assert.ok(propertyKeys.includes(field), `campo ausente em properties: ${field}`);
  }

  // OpenAI strict: required e properties têm exatamente o mesmo conjunto.
  assert.equal(schema.required.length, propertyKeys.length);
});

test('enums usam as opções vivas do Notion (multi_select e select)', () => {
  const schema = buildProtocolSchema(OPTIONS);

  assert.deepEqual(schema.properties.especialidade, {
    type: 'array',
    items: { type: 'string', enum: OPTIONS.especialidade },
  });
  assert.deepEqual(schema.properties.tipo_protocolo, {
    type: 'string',
    enum: OPTIONS.tipo_protocolo,
  });
});

test('sem opções cadastradas, o schema cai para string livre (schema válido)', () => {
  const schema = buildProtocolSchema({});

  assert.deepEqual(schema.properties.especialidade, {
    type: 'array',
    items: { type: 'string' },
  });
  assert.deepEqual(schema.properties.tipo_protocolo, { type: 'string' });
});

test('normalizeProtocol filtra valores fora das opções e gera slug', () => {
  const normalized = normalizeProtocol(
    {
      titulo: 'Cefaleia Tensional — Adulto',
      subcondicao: '  Recorte   Adulto  ',
      especialidade: ['Cardiologia', 'Especialidade Inventada'],
      contexto: ['Atenção Primária'],
      tipo_protocolo: 'Opção Inexistente',
      nivel_risco: ['Baixo'],
      resumo_clinico: '  Linha 1\n\n\nLinha 2  ',
      tags: ['itu', 'itu', 'cistite'],
    },
    OPTIONS,
  );

  assert.deepEqual(normalized.especialidade, ['Cardiologia']); // inválida descartada
  assert.equal(normalized.tipo_protocolo, ''); // select inválido vira vazio
  assert.deepEqual(normalized.nivel_risco, ['Baixo']);
  assert.equal(normalized.subcondicao, 'Recorte Adulto'); // texto curto colapsa espaços
  assert.equal(normalized.resumo_clinico, 'Linha 1\n\nLinha 2'); // texto longo: trim + colapsa quebras, preserva estrutura
  assert.deepEqual(normalized.tags, ['itu', 'cistite']); // deduplicado
  assert.equal(normalized.slug, 'cefaleia-tensional-adulto');
});
