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
  findExactPrescriptionGuideMatch,
} = require('../services/prescriptionGuides');

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
