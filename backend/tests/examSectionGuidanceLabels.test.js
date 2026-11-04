const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isMentalExamSection,
  isPhysicalExamSection,
  withExamSectionGuidance,
  MENTAL_EXAM_SECTION_GUIDANCE,
} = require('../utils/examSectionGuidance');

test('EEM (template de psiquiatria do CMS) é exame do estado mental', () => {
  assert.equal(isMentalExamSection('EEM'), true);
  assert.equal(isMentalExamSection('eem'), true);
  assert.equal(isMentalExamSection('Exame do Estado Mental'), true);
  assert.equal(isPhysicalExamSection('EEM'), false);
  // Não confundir com rótulos que só começam parecido.
  assert.equal(isMentalExamSection('EEMG'), false);
});

test('EEM recebe a orientação de estado mental, não a de aparelhos', () => {
  const guidance = withExamSectionGuidance(['ID', 'QP', 'EEM', 'HD']);
  assert.equal(guidance.EEM, MENTAL_EXAM_SECTION_GUIDANCE);
  assert.equal(guidance.ID, undefined);
});
