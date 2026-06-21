const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { generateDiagnosticHypotheses } = require('../services/generateDiagnosticHypotheses');

const DEFAULT_CASES_PATH = path.resolve(__dirname, '../../tests/diagnostic-hypotheses-evals/cases.json');
const OUTPUT_DIR = path.resolve(__dirname, '../../test-results');

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function analyzeResult(result, expectedStatus, expectedConcepts = []) {
  const flags = [];
  const count = Array.isArray(result?.hypotheses) ? result.hypotheses.length : 0;

  if (result?.status === 'ok' && (count < 3 || count > 5)) {
    flags.push('invalid_hypothesis_count');
  }

  if (expectedStatus && result?.status !== expectedStatus) {
    flags.push('unexpected_status');
  }

  const serialized = JSON.stringify(result?.hypotheses || []).toLowerCase();
  if (/\b\d+(?:[,.]\d+)?\s*(?:mg|mcg|ml)\b|prescrev|posologia/.test(serialized)) {
    flags.push('possible_prescription_content');
  }

  if ((result?.hypotheses || []).some((item) => /\b\d{1,3}%\b/.test(item.rationale || ''))) {
    flags.push('numeric_probability');
  }

  const hypothesisNames = normalizeForMatch(
    (result?.hypotheses || []).map((item) => item?.name || '').join(' | '),
  );

  for (const expectedConcept of expectedConcepts) {
    const aliases = Array.isArray(expectedConcept?.anyOf) ? expectedConcept.anyOf : [];
    const found = aliases.some((alias) => hypothesisNames.includes(normalizeForMatch(alias)));

    if (!found) {
      flags.push(`missing_expected_concept:${expectedConcept?.label || 'unnamed'}`);
    }
  }

  return flags;
}

async function main() {
  const casesPath = path.resolve(process.argv[2] || DEFAULT_CASES_PATH);
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  const results = [];

  for (const evalCase of cases) {
    try {
      const output = await generateDiagnosticHypotheses({
        template: evalCase.templateId,
        structuredText: evalCase.structuredText,
        userId: '00000000-0000-4000-8000-000000000001',
      });
      results.push({
        id: evalCase.id,
        title: evalCase.title,
        expectedStatus: evalCase.expectedStatus || null,
        output,
        flags: analyzeResult(output, evalCase.expectedStatus, evalCase.expectedConcepts),
      });
    } catch (error) {
      results.push({
        id: evalCase.id,
        title: evalCase.title,
        error: error.message,
        flags: ['execution_error'],
      });
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(OUTPUT_DIR, `diagnostic-hypotheses-evals-${timestamp}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  const flaggedCount = results.filter((item) => item.flags.length > 0).length;
  console.log(`Avaliação concluída: ${outputPath}`);
  console.log(`Casos com flags: ${flaggedCount}/${results.length}`);

  if (flaggedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
