const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CATALOG_SOURCES,
  getCatalogSummary,
  parseContentRangeTotal,
  resetCatalogSummaryCache,
} = require('../services/catalogSummary');

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function withSupabaseEnv() {
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste';
}

function fakeFetch(totals, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const table = Object.values(CATALOG_SOURCES).find((source) => url.includes(`/rest/v1/${source.table}?`))?.table;
    const total = totals[table];

    if (total === undefined) {
      return { ok: false, status: 500, headers: new Map() };
    }

    return { ok: true, status: 206, headers: new Map([['content-range', `0-0/${total}`]]) };
  };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  resetCatalogSummaryCache();
});

test('lê o total do content-range do PostgREST', () => {
  assert.equal(parseContentRangeTotal('0-0/568'), 568);
  assert.equal(parseContentRangeTotal('*/0'), 0);
  assert.equal(parseContentRangeTotal('0-0/*'), null);
  assert.equal(parseContentRangeTotal(null), null);
});

test('conta só o publicado, sem baixar linhas', async () => {
  withSupabaseEnv();
  const calls = [];
  global.fetch = fakeFetch({
    clinical_drugs: 568,
    prescription_guides: 218,
    clinical_tools: 114,
    physical_exam_maneuvers: 113,
    diagnostic_exams: 120,
  }, calls);

  const summary = await getCatalogSummary();

  assert.deepEqual(summary, {
    clinicalDrugs: 568,
    prescriptionGuides: 218,
    clinicalTools: 114,
    maneuvers: 113,
    exams: 120,
  });
  assert.ok(calls.every((call) => call.options.method === 'HEAD'));
  assert.ok(calls.every((call) => call.options.headers.Prefer === 'count=exact'));
  assert.ok(calls.find((call) => call.url.includes('clinical_drugs')).url.includes('publication_status=eq.published'));
  assert.ok(calls.filter((call) => !call.url.includes('clinical_drugs')).every((call) => call.url.includes('status=eq.published')));
});

test('dentro da validade responde da memória, sem nova consulta', async () => {
  withSupabaseEnv();
  const calls = [];
  global.fetch = fakeFetch({ clinical_drugs: 10 }, calls);

  await getCatalogSummary({ now: 1_000 });
  const antes = calls.length;
  await getCatalogSummary({ now: 2_000 });

  assert.equal(calls.length, antes);
});

test('uma fonte fora do ar vira null sem derrubar as outras', async () => {
  withSupabaseEnv();
  global.fetch = fakeFetch({ clinical_drugs: 568 });

  const summary = await getCatalogSummary();

  assert.equal(summary.clinicalDrugs, 568);
  assert.equal(summary.prescriptionGuides, null);
});

test('falha total não apaga o último número bom', async () => {
  withSupabaseEnv();
  global.fetch = fakeFetch({ clinical_drugs: 568 });
  await getCatalogSummary({ now: 0 });

  global.fetch = async () => {
    throw new Error('rede fora');
  };
  const summary = await getCatalogSummary({ now: 7 * 60 * 60 * 1000 });

  assert.equal(summary.clinicalDrugs, 568);
});

test('sem Supabase configurado não consulta nada', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  let chamou = false;
  global.fetch = async () => {
    chamou = true;
    return { ok: true };
  };

  assert.equal(await getCatalogSummary(), null);
  assert.equal(chamou, false);
});
