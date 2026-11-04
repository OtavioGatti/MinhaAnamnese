const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { listTemplates } = require('../services/templates');

const EVALS_DIR = path.join(__dirname, '..', '..', 'tests', 'anamnese-evals');

// Templates que só existem no CMS (Notion → Supabase) e, portanto, não
// aparecem em listTemplates(). Lista conferida em 04/11/2026; template novo no
// Notion que entrar num eval precisa ser adicionado aqui.
const CMS_TEMPLATE_IDS = [
  'pediatria_puericultura',
  'pediatria_urgencia',
  'geriatria',
  'evolucao_clinica_medica',
  'upa_enfermaria',
];

const KNOWN_TEMPLATE_IDS = new Set([
  ...listTemplates().map((template) => template.id),
  ...CMS_TEMPLATE_IDS,
]);

const caseFiles = fs
  .readdirSync(EVALS_DIR)
  .filter((name) => name.startsWith('cases') && name.endsWith('.json'));

test('há arquivos de casos de avaliação', () => {
  assert.ok(caseFiles.length > 0);
});

for (const fileName of caseFiles) {
  test(`${fileName}: todo caso aponta para template que existe`, () => {
    const cases = JSON.parse(fs.readFileSync(path.join(EVALS_DIR, fileName), 'utf8'));
    assert.ok(Array.isArray(cases) && cases.length > 0, 'arquivo sem casos');

    const ids = new Set();

    for (const testCase of cases) {
      assert.equal(typeof testCase.id, 'string', 'caso sem id');
      assert.ok(!ids.has(testCase.id), `id repetido: ${testCase.id}`);
      ids.add(testCase.id);
      // Casos de organizar trazem rawText; os de hipóteses, structuredText.
      assert.ok(
        String(testCase.rawText || testCase.structuredText || '').trim(),
        `caso ${testCase.id} sem rawText nem structuredText`,
      );
      assert.ok(
        KNOWN_TEMPLATE_IDS.has(testCase.templateId),
        `caso ${testCase.id} usa template inexistente: ${testCase.templateId}`,
      );
    }
  });
}
