const assert = require('node:assert/strict');
const test = require('node:test');

const { getTrialUsageSummary } = require('../services/trialUsage');

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const USER_ID = '11111111-1111-4111-8111-111111111111';

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test('resumo do teste inclui as ferramentas clínicas, contadas uma vez por ferramenta', async () => {
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste';
  const rowsByAction = {
    trial_insight: [{ id: 1 }, { id: 2 }],
    clinical_tool: [
      { id: 10, resource_key: 'apgar' },
      { id: 11, resource_key: 'apgar' },
      { id: 12, resource_key: 'curb-65' },
    ],
  };
  global.fetch = async (url) => {
    const action = new URL(url).searchParams.get('action').replace('eq.', '');
    return { ok: true, status: 200, json: async () => rowsByAction[action] || [] };
  };

  const { used } = await getTrialUsageSummary(USER_ID);

  assert.equal(used.insights, 2);
  assert.equal(used.clinicalTools, 2);
  assert.equal(used.referralLetters, 0);
});

test('sem armazenamento o resumo volta zerado, com as mesmas chaves', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { used } = await getTrialUsageSummary(USER_ID);

  assert.deepEqual(Object.keys(used).sort(), [
    'clinicalDrugs',
    'clinicalTools',
    'diagnosticHypotheses',
    'insights',
    'prescriptionGuides',
    'referralLetters',
    'userTemplates',
  ]);
  assert.ok(Object.values(used).every((value) => value === 0));
});
