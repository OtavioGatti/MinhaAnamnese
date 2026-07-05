const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeCopyPrescription,
  buildCanonicalCompleteText,
  finalizeAutomationProtocol,
  normalizeCid10Options,
  findNestedPrescriptionWarnings,
  PRESCRIPTION_SEPARATOR,
} = require('../contracts/protocolAutomation');

test('o separador canônico tem exatamente 40 hifens', () => {
  assert.equal(PRESCRIPTION_SEPARATOR, '-'.repeat(40));
});

test('normalizeCopyPrescription canoniza separador, parágrafo e espaçamento', () => {
  const input = [
    '-Opção 1: Cistite não complicada',
    '[1] Nitrofurantoina 100 mg ---- 1 comp 6/6h por 5 dias',
    '[2] Fosfomicina 3 g -------- dose única',
  ].join('\n');

  const out = normalizeCopyPrescription(input);

  // Separador normalizado para 40 hifens, com a instrução virando parágrafo.
  assert.ok(out.includes(`[1] Nitrofurantoina 100 mg ${PRESCRIPTION_SEPARATOR}\n\n1 comp 6/6h por 5 dias`));
  // Nenhum resquício de separadores fora do padrão (ex.: 4 ou 8 hifens soltos).
  assert.ok(!/ -{3,39}(?!-)/.test(out), 'sobrou separador com menos de 40 hifens');
  assert.ok(!/-{41,}/.test(out), 'separador com mais de 40 hifens');
  // Linha em branco antes de cada item [n].
  assert.ok(out.includes('\n\n[2] Fosfomicina 3 g'));
});

test('remove linhas separadoras soltas entre opções', () => {
  const input = [
    '-Opção 1: A',
    '[1] Dipirona 500 mg ---- 6/6h',
    '',
    ' ----------------------------------------',
    '',
    '-Opção 2: B',
    '[1] Cefalexina 500 mg ---- 6/6h',
  ].join('\n');

  const out = normalizeCopyPrescription(input);

  // Nenhuma linha composta apenas por hifens deve sobrar.
  const hasStandaloneSeparator = out.split('\n').some((line) => /^[ \t]*-{3,}[ \t]*$/.test(line));
  assert.ok(!hasStandaloneSeparator, 'sobrou linha separadora solta');
  assert.ok(out.includes('[1] Dipirona 500 mg ' + PRESCRIPTION_SEPARATOR));
});

test('buildCanonicalCompleteText monta -CONDUTA / -PRESCRIÇÃO / -ORIENTAÇÕES', () => {
  const completo = buildCanonicalCompleteText({
    conduta: '-Avaliar sinais vitais.',
    prescricao: '-Opção 1: Padrão\n\n[1] Dipirona 500 mg',
    orientacoes: '-Hidratar bem.',
  });

  assert.ok(completo.startsWith('-CONDUTA:\n-Avaliar sinais vitais.'));
  assert.ok(completo.includes('\n\n-PRESCRIÇÃO:\n\n-Opção 1: Padrão'));
  assert.ok(completo.includes('\n\n-ORIENTAÇÕES:\n-Hidratar bem.'));
});

test('finalizeAutomationProtocol reconstrói o completo e ignora o que o modelo mandou', () => {
  const finalized = finalizeAutomationProtocol({
    titulo: 'ITU — Adulto',
    texto_copiavel_conduta: '-Confirmar clínica.',
    texto_copiavel_prescricao: '-Opção 1: Mulher\n[1] Nitrofurantoina 100 mg ---- 6/6h',
    texto_copiavel_orientacoes: '-Beber água.',
    texto_copiavel_completo: 'CONTEUDO ANTIGO QUE DEVE SER IGNORADO',
  }, {});

  assert.ok(!finalized.texto_copiavel_completo.includes('IGNORADO'));
  assert.ok(finalized.texto_copiavel_completo.startsWith('-CONDUTA:'));
  assert.ok(finalized.texto_copiavel_completo.includes('-PRESCRIÇÃO:'));
  assert.ok(finalized.texto_copiavel_completo.includes(PRESCRIPTION_SEPARATOR));
  // A trava continua valendo.
  assert.equal(finalized.pronto_para_supabase, false);
});

test('normalizeCid10Options reformata o caso real do bug: tudo em uma linha "N | CODE"', () => {
  // Exatamente o que saiu gerado: "1 | T42.4 2 | F13.0 3 | F13.1" (uma linha só).
  const out = normalizeCid10Options('1 | T42.4 2 | F13.0 3 | F13.1');
  assert.equal(out, 'Opção 1: T42.4\nOpção 2: F13.0\nOpção 3: F13.1');
});

test('normalizeCid10Options é idempotente sobre o formato canônico existente', () => {
  const canonico = [
    'Opção 1: H60.3',
    'Opção 2: H60.4',
    'Opção 3: H60.3',
    'Opção 4: H60.5',
  ].join('\n');
  // Códigos repetidos em opções DIFERENTES (1 e 3 ambos H60.3) não são
  // deduplicados — só duplicatas exatas (mesmo número + mesmo código) são.
  assert.equal(normalizeCid10Options(canonico), canonico);
});

test('normalizeCid10Options normaliza vírgula decimal e remove duplicata exata', () => {
  const out = normalizeCid10Options('1 | N39,0\n1 | N39.0\n2 | N30.0');
  assert.equal(out, 'Opção 1: N39.0\nOpção 2: N30.0');
});

test('normalizeCid10Options cai para normalizeText quando não há nenhum código reconhecível', () => {
  assert.equal(normalizeCid10Options(''), '');
  assert.equal(normalizeCid10Options('sem codigo aqui'), 'sem codigo aqui');
});

test('finalizeAutomationProtocol reformata cid10_opcoes mesmo vindo achatado do modelo', () => {
  const finalized = finalizeAutomationProtocol({
    titulo: 'Intoxicação por Benzodiazepínicos',
    cid10_opcoes: '1 | T42.4 2 | F13.0 3 | F13.1',
  }, {});

  assert.equal(finalized.cid10_opcoes, 'Opção 1: T42.4\nOpção 2: F13.0\nOpção 3: F13.1');
});

test('findNestedPrescriptionWarnings detecta o caso real: Ceftriaxona escondendo Metronidazol', () => {
  const prescricao = normalizeCopyPrescription([
    '[4] Ceftriaxona 1g ---- intravenoso a cada 12 horas + Metronidazol 500 mg ---- intravenoso a cada 8 horas, cobertura empírica',
  ].join('\n'));

  const warnings = findNestedPrescriptionWarnings(prescricao);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /\[4\]/);
});

test('findNestedPrescriptionWarnings não sinaliza itens numerados corretamente', () => {
  const prescricao = normalizeCopyPrescription([
    '[4] Ceftriaxona 1g ---- intravenoso a cada 12 horas, associar ao item [5]',
    '[5] Metronidazol 500 mg ---- intravenoso a cada 8 horas',
  ].join('\n'));

  assert.deepEqual(findNestedPrescriptionWarnings(prescricao), []);
});

test('findNestedPrescriptionWarnings não sinaliza quando não há separador nenhum', () => {
  assert.deepEqual(findNestedPrescriptionWarnings(''), []);
  assert.deepEqual(findNestedPrescriptionWarnings('texto qualquer sem itens'), []);
});
