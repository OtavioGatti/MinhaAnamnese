const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildLetterSystemPrompt,
  normalizeFormatTemplate,
  validateLetterInput,
} = require('../services/letters');
const { getLetterType, normalizeLetterTypeKey, LETTER_TYPES } = require('../config/letterTypes');
const {
  normalizeOfficialLetterModelPayload,
  resolveLetterTypeKey,
} = require('../services/officialLetterModels');

test('normalizeLetterTypeKey cai no encaminhamento para valores desconhecidos', () => {
  assert.equal(normalizeLetterTypeKey('encaminhamento'), 'encaminhamento');
  assert.equal(normalizeLetterTypeKey('relatorio'), 'relatorio');
  assert.equal(normalizeLetterTypeKey('inexistente'), 'encaminhamento');
  assert.equal(normalizeLetterTypeKey(undefined), 'encaminhamento');
});

test('os 5 tipos de carta estão registrados', () => {
  const keys = LETTER_TYPES.map((type) => type.key);
  assert.deepEqual(keys, ['encaminhamento', 'contrarreferencia', 'relatorio', 'solicitacao', 'declaracao']);
});

test('buildLetterSystemPrompt mantém regras fixas e usa o formato padrão do tipo', () => {
  const prompt = buildLetterSystemPrompt(getLetterType('encaminhamento'), '', null);

  assert.ok(prompt.includes('Nunca invente'), 'regras anti-invenção presentes');
  assert.ok(prompt.includes('CARTA DE ENCAMINHAMENTO'), 'formato padrão do tipo presente');
});

test('formato do usuário é injetado sem derrubar as regras fixas', () => {
  const custom = 'MODELO CUSTOM\n[resumo]\nDr. Fulano — CRM 12345';
  const prompt = buildLetterSystemPrompt(getLetterType('encaminhamento'), custom, null);

  assert.ok(prompt.includes('Dr. Fulano — CRM 12345'), 'assinatura do usuário presente');
  assert.ok(prompt.includes('Nunca invente'), 'regras fixas continuam presentes');
  assert.ok(!prompt.includes('CARTA DE ENCAMINHAMENTO'), 'padrão substituído pelo do usuário');
});

test('override do Notion com token {{formato_saida}} renderiza o formato', () => {
  const prompt = buildLetterSystemPrompt(
    getLetterType('encaminhamento'),
    'FORMATO ESCOLHIDO',
    'REGRAS EDITORIAIS\n{{formato_saida}}\nFIM',
  );

  assert.ok(prompt.includes('REGRAS EDITORIAIS'), 'corpo do override presente');
  assert.ok(prompt.includes('FORMATO ESCOLHIDO'), 'formato injetado no token');
});

test('override sem token é ignorado (mantém regras fixas + formato)', () => {
  const prompt = buildLetterSystemPrompt(
    getLetterType('encaminhamento'),
    '',
    'PROMPT SEM TOKEN',
  );

  assert.ok(!prompt.includes('PROMPT SEM TOKEN'), 'override sem token não é usado');
  assert.ok(prompt.includes('Nunca invente'), 'regras fixas garantidas');
});

test('declaração de comparecimento reforça ausência de CID/diagnóstico', () => {
  const prompt = buildLetterSystemPrompt(getLetterType('declaracao'), '', null);
  assert.ok(prompt.includes('NÃO inclua CID'), 'regra administrativa específica presente');
});

test('validateLetterInput exige campos obrigatórios do tipo', () => {
  assert.equal(
    validateLetterInput({ letterType: 'encaminhamento', texto: 'quadro', fields: {} }),
    'Informe: Especialidade de destino.',
  );
  assert.equal(
    validateLetterInput({ letterType: 'encaminhamento', texto: 'quadro', fields: { specialty: 'Cardiologia' } }),
    null,
  );
  assert.equal(
    validateLetterInput({ letterType: 'relatorio', texto: 'quadro', fields: { purpose: 'Perícia' } }),
    null,
  );
});

test('validateLetterInput rejeita texto vazio e tipo inválido', () => {
  assert.equal(
    validateLetterInput({ letterType: 'encaminhamento', texto: '', fields: { specialty: 'X' } }),
    'Preencha a historia clinica antes de gerar o documento.',
  );
});

test('normalizeFormatTemplate limita tamanho e normaliza quebras', () => {
  assert.equal(normalizeFormatTemplate('a\r\nb'), 'a\nb');
  assert.equal(normalizeFormatTemplate('x'.repeat(5000)).length, 4000);
});

test('resolveLetterTypeKey converte rótulos do Notion para keys', () => {
  assert.equal(resolveLetterTypeKey('Contra-referência'), 'contrarreferencia');
  assert.equal(resolveLetterTypeKey('Relatório médico'), 'relatorio');
  assert.equal(resolveLetterTypeKey('Declaração de comparecimento'), 'declaracao');
  assert.equal(resolveLetterTypeKey('Encaminhamento'), 'encaminhamento');
});

test('normalizeOfficialLetterModelPayload valida e mapeia o tipo', () => {
  const ok = normalizeOfficialLetterModelPayload({
    slug: 'Relatorio Padrao',
    name: 'Relatório padrão',
    status: 'Published',
    letterType: 'Relatório médico',
    formatBody: 'RELATÓRIO\n[resumo]',
  });

  assert.equal(ok.error, null);
  assert.equal(ok.payload.slug, 'relatorio_padrao');
  assert.equal(ok.payload.letter_type, 'relatorio');
  assert.equal(ok.payload.status, 'published');

  const bad = normalizeOfficialLetterModelPayload({ slug: '', name: '', formatBody: '' });
  assert.equal(bad.payload, null);
  assert.deepEqual(bad.error.reasons, ['missing_slug', 'missing_name', 'missing_format_body']);
});
