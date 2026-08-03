const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeDiagnosticHypotheses,
} = require('../contracts/diagnosticHypotheses');
const {
  buildDiagnosticHypothesesInstructions,
} = require('../prompts/diagnosticHypothesesPrompt');
const {
  createSafetyIdentifier,
  parseDiagnosticResponse,
  resolveDiagnosticModel,
  validateDiagnosticHypothesesInput,
} = require('../services/generateDiagnosticHypotheses');
const {
  buildHypothesisGuideRef,
  findExactPrescriptionGuideMatch,
} = require('../services/prescriptionGuides');
const {
  collectUnmatchedHypotheses,
  recordUnmatchedHypotheses,
} = require('../services/unmatchedHypotheses');

function hypothesis(name, priority = 'differential') {
  return {
    name,
    priority,
    rationale: 'Compatível com os dados documentados.',
    supportingEvidence: ['Dado presente'],
    missingOrConflictingData: [],
    differentiatingSteps: ['Reavaliar clinicamente'],
    redFlags: [],
  };
}

test('reclassifica como dados insuficientes sem inventar três hipóteses', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [hypothesis('Hipótese única')],
    missingData: ['Exame físico'],
    generalWarnings: [],
  });

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.hypotheses.length, 1);
});

test('limita hipóteses, listas e prioridades fora do contrato', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: Array.from({ length: 7 }, (_, index) => hypothesis(`Hipótese ${index}`, 'invalid')),
    missingData: Array.from({ length: 12 }, (_, index) => `Dado ${index}`),
    generalWarnings: [],
  });

  assert.equal(result.hypotheses.length, 5);
  assert.equal(result.missingData.length, 8);
  assert.equal(result.hypotheses[0].priority, 'differential');
});

test('preserva a classificação de problema ativo documentado', () => {
  const result = normalizeDiagnosticHypotheses({
    status: 'ok',
    hypotheses: [
      hypothesis('Lesão por pressão grau 4', 'documented_problem'),
      hypothesis('Hipótese B'),
      hypothesis('Hipótese C'),
    ],
    missingData: [],
    generalWarnings: [],
  });

  assert.equal(result.hypotheses[0].priority, 'documented_problem');
});

test('guardrails imutáveis permanecem mesmo com prompt editorial curto', () => {
  const instructions = buildDiagnosticHypothesesInstructions('Seja objetivo.');

  assert.match(instructions, /CONTRATO DE SEGURANÇA IMUTÁVEL/);
  assert.match(instructions, /não invente hipóteses/i);
  assert.match(instructions, /problemas ativos explicitamente documentados/i);
  assert.match(instructions, /Seja objetivo/);
});

test('modelo do CMS passa por allowlist', () => {
  assert.equal(resolveDiagnosticModel('gpt-4o-mini'), 'gpt-4o-mini');
  assert.equal(resolveDiagnosticModel('modelo-inexistente'), 'gpt-4o');
});

test('safety identifier é estável e não expõe o id original', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const identifier = createSafetyIdentifier(userId);

  assert.equal(identifier, createSafetyIdentifier(userId));
  assert.equal(identifier.length, 64);
  assert.equal(identifier.includes(userId), false);
});

test('parser aceita Structured Output e trata recusas', () => {
  const parsed = parseDiagnosticResponse({
    output_text: JSON.stringify({
      status: 'ok',
      hypotheses: [hypothesis('A'), hypothesis('B'), hypothesis('C')],
      missingData: [],
      generalWarnings: [],
    }),
  });
  const refused = parseDiagnosticResponse({
    output: [{ content: [{ type: 'refusal', refusal: 'Não posso analisar.' }] }],
  });

  assert.equal(parsed.status, 'ok');
  assert.equal(refused.status, 'refused');
});

test('vínculo de prescrição exige correspondência exata normalizada', () => {
  const guides = [
    {
      slug: 'pneumonia-adquirida-na-comunidade',
      title: 'Pneumonia adquirida na comunidade',
      conditionName: 'Pneumonia adquirida na comunidade',
      subcondition: '',
    },
  ];

  assert.equal(
    findExactPrescriptionGuideMatch('Pneumonia adquirida na comunidade', guides)?.slug,
    guides[0].slug,
  );
  assert.equal(findExactPrescriptionGuideMatch('Pneumonia', guides), null);
});

test('backlog registra só hipóteses sem guia, deduplicadas', () => {
  const entries = collectUnmatchedHypotheses([
    { name: 'Pneumonia Adquirida na Comunidade (PAC)', prescriptionGuide: { slug: 'pac' } },
    { name: 'Lesão por Pressão Grau 4' },
    { name: 'lesão por pressão grau 4' },
    { name: 'Delirium' },
  ]);

  assert.deepEqual(entries.map((entry) => entry.displayName), [
    'Lesão por Pressão Grau 4',
    'Delirium',
  ]);
  assert.equal(entries[0].normalizedName, 'lesao por pressao grau 4');
});

test('backlog ignora nomes vazios ou curtos demais para virar prescrição', () => {
  assert.deepEqual(collectUnmatchedHypotheses([{ name: '' }, { name: '  ' }, { name: 'AB' }]), []);
  assert.deepEqual(collectUnmatchedHypotheses(null), []);
});

test('sem Supabase configurado o backlog degrada em silêncio', async () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalViteUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    assert.equal(await recordUnmatchedHypotheses([{ name: 'Delirium' }]), 0);
  } finally {
    if (originalUrl) process.env.SUPABASE_URL = originalUrl;
    if (originalViteUrl) process.env.VITE_SUPABASE_URL = originalViteUrl;
    if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('referência do guia leva o CID-10 revisado para a hipótese', () => {
  const ref = buildHypothesisGuideRef({
    slug: 'pneumonia-adquirida-na-comunidade',
    title: 'Pneumonia adquirida na comunidade',
    conditionName: 'Pneumonia adquirida na comunidade',
    cid10Primary: 'J18.9',
  });

  assert.equal(ref.cid10Primary, 'J18.9');
  assert.equal(ref.matchType, 'exact');
});

test('guia sem CID cadastrado não inventa código', () => {
  const semCid = buildHypothesisGuideRef({
    slug: 'condicao-sem-cid',
    title: 'Condição sem CID',
    conditionName: 'Condição sem CID',
  });

  assert.equal(semCid.cid10Primary, '');
  assert.equal(buildHypothesisGuideRef(null), null);
});

test('validação exige template e história organizada', () => {
  assert.match(
    validateDiagnosticHypothesesInput({ template: '', structuredText: 'História' }),
    /modelo clínico/i,
  );
  assert.match(
    validateDiagnosticHypothesesInput({ template: 'clinica_medica', structuredText: '' }),
    /Organize a anamnese/i,
  );
  assert.equal(
    validateDiagnosticHypothesesInput({ template: 'clinica_medica', structuredText: 'História' }),
    null,
  );
});
