const assert = require('node:assert/strict');
const test = require('node:test');

const { removeLinhasVaziasDoExame } = require('../utils/examSectionCleanup');

const SECOES = ['ID', 'QP', 'HDA', 'MUC', 'EF', 'HD'];

// O caso real medido: o modelo cria linha para sistema que ninguém examinou.
test('remove linha de sistema que só tem marcador', () => {
  const entrada = [
    'ID: Homem, 62 anos',
    'EF:',
    '- SSVV: [Não relatado]',
    '- AP: Estertores crepitantes em base direita.',
    '- AC: [Não relatado]',
    '- ABD: Abdome doloroso.',
    '- NEURO: [Não relatado]',
    'HD: [Não relatado]',
  ].join('\n');

  const saida = removeLinhasVaziasDoExame(entrada, SECOES);

  assert.ok(!saida.includes('SSVV'), 'SSVV vazio deveria sumir');
  assert.ok(!saida.includes('NEURO'), 'NEURO vazio deveria sumir');
  assert.ok(saida.includes('AP: Estertores crepitantes'), 'achado real fica');
  assert.ok(saida.includes('ABD: Abdome doloroso'), 'achado real fica');
  // Marcador em SEÇÃO vazia é correto e não pode ser tocado.
  assert.ok(saida.includes('HD: [Não relatado]'), 'seção vazia mantém o marcador');
});

test('não toca em marcador de outras seções', () => {
  const entrada = ['ID: [Não relatado]', 'QP: Dor', 'MUC: [Não relatado]', 'EF: BEG'].join('\n');

  assert.equal(removeLinhasVaziasDoExame(entrada, SECOES), entrada);
});

// Se a linha tem achado junto do marcador, é conteúdo real: não pode sumir.
test('preserva linha com conteúdo além do marcador', () => {
  const entrada = ['EF:', '- AC: [Não relatado] mas refere sopro prévio', 'HD: x'].join('\n');

  assert.ok(removeLinhasVaziasDoExame(entrada, SECOES).includes('refere sopro prévio'));
});

// Exame realmente sem nada: a seção existe e está vazia, então o marcador é
// legítimo — uma vez, no rótulo, não por sistema.
test('exame inteiro vazio vira um marcador só, no rótulo', () => {
  const entrada = [
    'QP: Dor',
    'EF:',
    '- SSVV: [Não relatado]',
    '- AC: [Não relatado]',
    'HD: x',
  ].join('\n');

  const saida = removeLinhasVaziasDoExame(entrada, SECOES);
  const linhas = saida.split('\n');

  assert.equal(linhas.filter((l) => l.includes('[Não relatado]')).length, 1);
  assert.ok(saida.includes('EF: [Não relatado]'));
});

test('marcador solto sem sigla também sai', () => {
  const entrada = ['EF:', '- [Não relatado]', '- ABD: Doloroso', 'HD: x'].join('\n');
  const saida = removeLinhasVaziasDoExame(entrada, SECOES);

  assert.ok(!saida.includes('- [Não relatado]'));
  assert.ok(saida.includes('ABD: Doloroso'));
});

test('aceita as variações de marcador que os prompts usam', () => {
  ['[Não relatado]', '[nao relatado]', '[DADO AUSENTE]', '[INFORMAÇÃO INSUFICIENTE]'].forEach((marcador) => {
    const entrada = ['EF:', `- AC: ${marcador}`, '- ABD: Doloroso', 'HD: x'].join('\n');

    assert.ok(
      !removeLinhasVaziasDoExame(entrada, SECOES).includes(marcador),
      `deveria remover ${marcador}`,
    );
  });
});

test('exame do estado mental segue a mesma regra', () => {
  const secoes = ['ID', 'Exame do estado mental', 'HD'];
  const entrada = [
    'Exame do estado mental:',
    '- Humor: deprimido',
    '- Sensopercepção: [Não relatado]',
    'HD: x',
  ].join('\n');

  const saida = removeLinhasVaziasDoExame(entrada, secoes);

  assert.ok(!saida.includes('Sensopercepção'));
  assert.ok(saida.includes('Humor: deprimido'));
});

test('entrada vazia ou sem seções não quebra', () => {
  assert.equal(removeLinhasVaziasDoExame('', SECOES), '');
  assert.equal(removeLinhasVaziasDoExame('EF: x', []), 'EF: x');
  assert.equal(removeLinhasVaziasDoExame(null, SECOES), null);
});
