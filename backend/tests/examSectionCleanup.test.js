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

// --- rede de segurança contra perda de achado ------------------------------

const { preservaAchadosDoExame } = require('../utils/examSectionCleanup');

// O caso real: C+P não estava na lista de siglas, o modelo encaixou a tireoide
// em AP e o achado pulmonar ALTERADO foi sobrescrito e sumiu.
test('devolve achado de sistema que sumiu por completo', () => {
  const original = [
    'C+P: Tireoide normopalpável, indolor',
    'AP: Murmúrios abolidos em base, estertorando difusamente',
  ].join('\n');
  const saida = ['EF:', '- AP: Tireoide normopalpável, indolor', 'HD: x'].join('\n');

  const corrigido = preservaAchadosDoExame(saida, original, SECOES);

  assert.match(corrigido, /Murmúrios abolidos em base, estertorando difusamente/);
  // Devolve com as palavras do médico, dentro do exame, antes da próxima seção.
  assert.ok(corrigido.indexOf('estertorando') < corrigido.indexOf('HD: x'));
});

// Reescrita clínica normal preserva parte das palavras — não pode disparar.
test('não duplica quando o achado só foi reescrito', () => {
  const original = 'AC: BRNF 2T SEM SOPROS AUDÍVEIS';
  const saida = ['EF:', '- AC: Bulhas normofonéticas, sem sopros audíveis.', 'HD: x'].join('\n');

  assert.equal(preservaAchadosDoExame(saida, original, SECOES), saida);
});

test('ignora rótulo que não é de sistema do exame', () => {
  const original = 'MUC: losartana 50mg\nHDA: dor há 3 dias';
  const saida = ['EF:', '- ABD: Doloroso', 'HD: x'].join('\n');

  // MUC e HDA podem ser realocados legitimamente; não é papel desta rede.
  assert.equal(preservaAchadosDoExame(saida, original, SECOES), saida);
});

test('não age quando a linha só tem palavra genérica', () => {
  const original = 'AP: sem alterações';
  const saida = ['EF:', '- ABD: Doloroso', 'HD: x'].join('\n');

  // "sem" e "alterações" são genéricas demais para provar perda.
  assert.equal(preservaAchadosDoExame(saida, original, SECOES), saida);
});

test('achado devolvido reabre exame que tinha virado seção vazia', () => {
  const original = 'AP: Murmúrios abolidos em base, estertorando difusamente';
  const saida = ['QP: Dor', 'EF: [Não relatado]', 'HD: x'].join('\n');

  const corrigido = preservaAchadosDoExame(saida, original, SECOES);

  assert.match(corrigido, /estertorando/);
  assert.ok(!/EF: \[Não relatado\]/.test(corrigido), 'exame deixou de estar vazio');
});

test('entrada vazia não quebra', () => {
  assert.equal(preservaAchadosDoExame('EF: x', '', SECOES), 'EF: x');
  assert.equal(preservaAchadosDoExame('', 'AP: algo', SECOES), '');
});
