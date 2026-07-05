const assert = require('node:assert/strict');
const test = require('node:test');
const {
  chunkText,
  buildPropertyValue,
  buildProtocolProperties,
  NOTION_TEXT_LIMIT,
} = require('../services/notionProtocolWriter');

test('chunkText respeita o limite de 2000 e preserva todos os caracteres', () => {
  const line = 'Linha de prescrição com algum conteúdo clínico.\n';
  const big = line.repeat(200); // ~9k chars com muitas quebras
  const chunks = chunkText(big);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= NOTION_TEXT_LIMIT, `chunk excede ${NOTION_TEXT_LIMIT}`);
  }
  assert.equal(chunks.join(''), big); // concatenação reproduz o original
});

test('chunkText devolve [] para vazio e [texto] para texto curto', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('curto'), ['curto']);
});

test('buildPropertyValue monta cada tipo do Notion corretamente', () => {
  assert.deepEqual(buildPropertyValue('title', 'ITU'), { title: [{ type: 'text', text: { content: 'ITU' } }] });
  assert.deepEqual(buildPropertyValue('select', 'Ambulatorial'), { select: { name: 'Ambulatorial' } });
  assert.deepEqual(buildPropertyValue('select', ''), { select: null });
  assert.deepEqual(buildPropertyValue('multi_select', ['A', 'B']), { multi_select: [{ name: 'A' }, { name: 'B' }] });
  assert.deepEqual(buildPropertyValue('checkbox', false), { checkbox: false });
  assert.deepEqual(buildPropertyValue('checkbox', 'qualquer'), { checkbox: true });
  assert.deepEqual(buildPropertyValue('date', '2026-07-05'), { date: { start: '2026-07-05' } });
  assert.equal(buildPropertyValue('formula', 'x'), null); // tipo não gravável
});

test('buildProtocolProperties usa o typeMap, pula tipos não graváveis e respeita fields', () => {
  const typeMap = {
    titulo: 'title',
    resumo_clinico: 'rich_text',
    tipo_protocolo: 'select',
    especialidade: 'multi_select',
    pronto_para_supabase: 'checkbox',
    calculado: 'formula', // não gravável
  };
  const protocol = {
    titulo: 'ITU',
    resumo_clinico: 'Resumo',
    tipo_protocolo: 'Ambulatorial',
    especialidade: ['Clínica Médica'],
    pronto_para_supabase: false,
    calculado: 'nao deve entrar',
    inexistente: 'ignorar',
  };

  const all = buildProtocolProperties(protocol, typeMap);
  assert.deepEqual(Object.keys(all).sort(), ['especialidade', 'pronto_para_supabase', 'resumo_clinico', 'tipo_protocolo', 'titulo']);
  assert.ok(!('calculado' in all)); // formula pulada
  assert.ok(!('inexistente' in all)); // sem propriedade na base

  const subset = buildProtocolProperties(protocol, typeMap, { fields: ['resumo_clinico', 'pronto_para_supabase'] });
  assert.deepEqual(Object.keys(subset).sort(), ['pronto_para_supabase', 'resumo_clinico']);
});
