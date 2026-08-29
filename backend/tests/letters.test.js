const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyConditionalFormatBlocks,
  buildLetterSystemPrompt,
  getCid10Error,
  getTodayDateBR,
  normalizeCid10,
  normalizeFormatTemplate,
  normalizeLetterFields,
  validateLetterInput,
} = require('../services/letters');
const { getLetterType, normalizeLetterTypeKey, LETTER_TYPES } = require('../config/letterTypes');
const {
  normalizeOfficialLetterModelPayload,
  resolveLetterTypeKey,
  resolveLetterTypeKeyStrict,
} = require('../services/officialLetterModels');

test('normalizeLetterTypeKey cai no encaminhamento para valores desconhecidos', () => {
  assert.equal(normalizeLetterTypeKey('encaminhamento'), 'encaminhamento');
  assert.equal(normalizeLetterTypeKey('relatorio'), 'relatorio');
  assert.equal(normalizeLetterTypeKey('inexistente'), 'encaminhamento');
  assert.equal(normalizeLetterTypeKey(undefined), 'encaminhamento');
});

test('os 7 tipos de carta estão registrados', () => {
  const keys = LETTER_TYPES.map((type) => type.key);
  assert.deepEqual(keys, ['encaminhamento', 'contrarreferencia', 'relatorio', 'solicitacao', 'declaracao', 'atestado', 'laudo']);
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
  assert.equal(resolveLetterTypeKey('Atestado'), 'atestado');
  assert.equal(resolveLetterTypeKey('Atestado médico'), 'atestado');
});

test('normalizeCid10 padroniza caixa e separadores', () => {
  assert.equal(normalizeCid10('j06.9'), 'J06.9');
  assert.equal(normalizeCid10(' m54 , j06.9 '), 'M54 J06.9');
  assert.equal(normalizeCid10(''), '');
});

test('getCid10Error aceita códigos da tabela e recusa texto livre', () => {
  assert.equal(getCid10Error(''), null, 'em branco é válido: CID é opcional');
  assert.equal(getCid10Error('J06.9'), null);
  assert.equal(getCid10Error('U07.1'), null, 'códigos da faixa U existem (COVID-19)');
  assert.equal(getCid10Error('M54 J06.9'), null, 'comorbidade: mais de um código');
  assert.ok(getCid10Error('gripe'), 'nome de doença não é código');
  assert.ok(getCid10Error('A01 A02 A03 A04 A05'), 'excesso de códigos é recusado');
});

test('normalizeLetterFields descarta campos não declarados pelo tipo', () => {
  const fields = normalizeLetterFields(getLetterType('declaracao'), {
    period: '23/07/2026',
    cid10: 'J06.9',
  });

  assert.equal(fields.period, '23/07/2026');
  assert.ok(!('cid10' in fields), 'declaração não declara cid10: campo não chega ao prompt');
});

test('applyConditionalFormatBlocks mantém ou remove o bloco de CID', () => {
  const format = 'ATESTADO\n\n{{#com_cid}}\nCID-10: [codigo].\n\n{{/com_cid}}\n[assinatura do médico]';

  assert.ok(applyConditionalFormatBlocks(format, { includeCid: true }).includes('CID-10'));
  assert.ok(!applyConditionalFormatBlocks(format, { includeCid: false }).includes('CID-10'));
  assert.ok(
    applyConditionalFormatBlocks(format, { includeCid: false }).includes('[assinatura do médico]'),
    'o restante do formato é preservado',
  );
  assert.equal(
    applyConditionalFormatBlocks(format, { includeCid: true }),
    'ATESTADO\n\nCID-10: [codigo].\n\n[assinatura do médico]',
    'a separação entre parágrafos sobrevive ao manter o bloco',
  );
  assert.equal(
    applyConditionalFormatBlocks(format, { includeCid: false }),
    'ATESTADO\n\n[assinatura do médico]',
    'a separação entre parágrafos sobrevive ao remover o bloco',
  );
});

test('marcador escrito fora de linha própria não vaza como texto no documento', () => {
  const malformed = 'ATESTADO {{#com_cid}}CID: [codigo].{{/com_cid}} fim';

  [true, false].forEach((includeCid) => {
    const result = applyConditionalFormatBlocks(malformed, { includeCid });
    assert.ok(!result.includes('com_cid'), `marcador removido (includeCid: ${includeCid})`);
  });
});

test('atestado sem CID sai sem diagnóstico e sem assinatura do paciente', () => {
  const prompt = buildLetterSystemPrompt(getLetterType('atestado'), '', null, { cid10: '' });

  assert.ok(!prompt.includes('CID-10:'), 'linha de CID removida do formato');
  assert.ok(!prompt.includes('Assinatura do paciente'), 'sem CID não há termo de ciência');
  assert.ok(prompt.includes('SEM CID'), 'regra condicional correta aplicada');
});

test('atestado com CID traz o termo de ciência do paciente', () => {
  const prompt = buildLetterSystemPrompt(getLetterType('atestado'), '', null, { cid10: 'J06.9' });

  assert.ok(prompt.includes('CID-10:'), 'linha de CID mantida no formato');
  assert.ok(prompt.includes('Assinatura do paciente'), 'termo de ciência presente');
  assert.ok(prompt.includes('COM CID'), 'regra condicional correta aplicada');
  assert.ok(prompt.includes('não o diagnóstico por extenso'), 'consentimento cobre o código, não a doença');
});

test('override do Notion não apaga as regras de consentimento do atestado', () => {
  const prompt = buildLetterSystemPrompt(
    getLetterType('atestado'),
    '',
    'REGRAS EDITORIAIS\n{{formato_saida}}\nFIM',
    { cid10: 'J06.9' },
  );

  assert.ok(prompt.includes('REGRAS EDITORIAIS'), 'override editorial aplicado');
  assert.ok(prompt.includes('COM CID'), 'regra de consentimento sobrevive ao override');
});

test('atestado preenche a data de emissão com a data real, nunca deixa o token ou o placeholder', () => {
  const prompt = buildLetterSystemPrompt(getLetterType('atestado'), '', null, { period: '7 dias' });
  const today = getTodayDateBR();

  assert.ok(prompt.includes(`[Cidade], ${today}.`), 'data de hoje injetada no lugar do token');
  assert.ok(!prompt.includes('{{data_emissao}}'), 'token não vaza para o prompt');
  assert.ok(!prompt.includes('[data]'), 'placeholder antigo não sobra');
});

test('{{data_emissao}} funciona também em formato customizado pelo usuário', () => {
  const custom = 'MODELO CUSTOM\nEmitido em {{data_emissao}}.';
  const prompt = buildLetterSystemPrompt(getLetterType('atestado'), custom, null, { period: '7 dias' });

  assert.ok(prompt.includes(`Emitido em ${getTodayDateBR()}.`), 'token do usuário também é resolvido pelo servidor');
});

test('modelo do usuário sem marcadores não deixa vazar CID quando não há CID', () => {
  const custom = 'ATESTADO DA CLÍNICA X\n[periodo]\nCID: [codigo]\nAssinatura do paciente: ______';
  const prompt = buildLetterSystemPrompt(getLetterType('atestado'), custom, null, { cid10: '' });

  // O formato do usuário é preservado (não temos como reescrevê-lo), mas a regra
  // condicional instrui a omitir CID e o bloco de ciência.
  assert.ok(prompt.includes('ATESTADO DA CLÍNICA X'), 'formato do usuário preservado');
  assert.ok(prompt.includes('Não inclua bloco de ciência'), 'regra cobre o formato sem marcadores');
});

test('laudo exige finalidade e CID', () => {
  assert.equal(
    validateLetterInput({ letterType: 'laudo', texto: 'quadro', fields: {} }),
    'Informe: Finalidade / órgão de destino.',
  );
  assert.equal(
    validateLetterInput({ letterType: 'laudo', texto: 'quadro', fields: { purpose: 'BPC/LOAS' } }),
    'Informe: CID-10.',
    'diferente do atestado, aqui o CID não é opcional',
  );
  assert.ok(
    validateLetterInput({ letterType: 'laudo', texto: 'quadro', fields: { purpose: 'BPC/LOAS', cid10: 'paralisia' } }),
    'CID em texto livre é recusado',
  );
  assert.equal(
    validateLetterInput({ letterType: 'laudo', texto: 'quadro', fields: { purpose: 'BPC/LOAS', cid10: 'G80.9' } }),
    null,
  );
});

test('laudo não pede assinatura do paciente e proíbe opinar sobre o benefício', () => {
  const prompt = buildLetterSystemPrompt(
    getLetterType('laudo'),
    '',
    null,
    { purpose: 'BPC/LOAS', cid10: 'G80.9' },
  );

  assert.ok(prompt.includes('LAUDO MÉDICO'), 'formato padrão do tipo presente');
  assert.ok(prompt.includes('REPERCUSSÃO FUNCIONAL'), 'objetivo central do laudo presente');
  assert.ok(prompt.includes('a decisão é do órgão avaliador'), 'não opina sobre direito ao benefício');
  assert.ok(!prompt.includes('Assinatura do paciente'), 'laudo não leva termo de ciência');
});

test('regras do laudo sobrevivem ao override de prompt do Notion', () => {
  const prompt = buildLetterSystemPrompt(
    getLetterType('laudo'),
    '',
    'REGRAS EDITORIAIS\n{{formato_saida}}\nFIM',
    { purpose: 'INSS', cid10: 'M54.5' },
  );

  assert.ok(prompt.includes('REGRAS EDITORIAIS'), 'override editorial aplicado');
  assert.ok(prompt.includes('REGRA DESTE LAUDO'), 'regra condicional sobrevive ao override');
});

test('modelo do usuário não injeta termo de ciência no laudo', () => {
  const custom = 'LAUDO DA CLÍNICA X\n[quadro]\nAssinatura do paciente: ______';
  const prompt = buildLetterSystemPrompt(getLetterType('laudo'), custom, null, { purpose: 'BPC', cid10: 'G80.9' });

  assert.ok(prompt.includes('LAUDO DA CLÍNICA X'), 'formato do usuário preservado');
  assert.ok(prompt.includes('Não inclua bloco de ciência'), 'regra cobre o formato escrito à mão');
});

test('validateLetterInput cobre os campos e o CID do atestado', () => {
  assert.equal(
    validateLetterInput({ letterType: 'atestado', texto: 'quadro', fields: {} }),
    'Informe: Tempo de afastamento.',
  );
  assert.equal(
    validateLetterInput({ letterType: 'atestado', texto: 'quadro', fields: { period: '3 dias' } }),
    null,
    'CID é opcional',
  );
  assert.equal(
    validateLetterInput({ letterType: 'atestado', texto: 'quadro', fields: { period: '3 dias', cid10: 'J06.9' } }),
    null,
  );
  assert.ok(
    validateLetterInput({ letterType: 'atestado', texto: 'quadro', fields: { period: '3 dias', cid10: 'gripe' } }),
    'CID em texto livre é recusado',
  );
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
  assert.deepEqual(bad.error.reasons, [
    'missing_slug',
    'missing_name',
    'missing_format_body',
    'missing_letter_type',
  ]);
});

// Regressão: antes, um "Letter type" desconhecido virava encaminhamento em
// silêncio — o modelo era publicado sob o tipo errado, sem erro nem sync_error.
test('sync recusa modelo do Notion com tipo desconhecido em vez de virar encaminhamento', () => {
  const result = normalizeOfficialLetterModelPayload({
    slug: 'laudo_bpc',
    name: 'Laudo BPC',
    status: 'Published',
    letterType: 'Tipo Que Nao Existe',
    formatBody: 'LAUDO\n[quadro]',
  });

  assert.equal(result.payload, null, 'não pode ser publicado sob outro tipo');
  assert.deepEqual(result.error.reasons, ['unknown_letter_type']);
});

test('resolveLetterTypeKeyStrict reconhece o laudo e rejeita o resto', () => {
  assert.equal(resolveLetterTypeKeyStrict('Laudo'), 'laudo');
  assert.equal(resolveLetterTypeKeyStrict('Laudo médico'), 'laudo');
  assert.equal(resolveLetterTypeKeyStrict('laudo'), 'laudo');
  assert.equal(resolveLetterTypeKeyStrict('Tipo Que Nao Existe'), null);
  assert.equal(resolveLetterTypeKeyStrict(''), null);
  assert.equal(resolveLetterTypeKeyStrict(undefined), null);
});
