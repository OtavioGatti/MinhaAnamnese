const assert = require('node:assert/strict');
const test = require('node:test');

// Os catálogos abrem sozinhos o 1º item da lista e pedem esse detalhe com
// `auto=1`. Abrir a página não é usar o recurso: essa leitura não pode gravar
// em `usage_logs` — senão o 1º item vira o "mais consultado" do painel.
//
// A busca do item é trocada ANTES de carregar os handlers (eles desestruturam
// na importação): validar uma ficha de verdade não é o que está em teste.
// Autenticação, perfil e a gravação do uso seguem o caminho real, via fetch.
const clinicalDrugs = require('../services/clinicalDrugs');
const clinicalTools = require('../services/clinicalTools');
const prescriptionGuides = require('../services/prescriptionGuides');

clinicalDrugs.getClinicalDrugBySlug = async (slug) => ({ slug, name: 'Abatacepte' });
clinicalTools.getClinicalToolBySlug = async (slug) => ({ slug, title: 'Gasometria', fields: [] });
prescriptionGuides.getPrescriptionGuideBySlug = async (slug) => ({ slug, title: 'Abdome agudo' });

const clinicalDrugsHandler = require('../apiHandlers/clinical-drugs');
const clinicalToolsHandler = require('../apiHandlers/clinical-tools');
const prescriptionGuidesHandler = require('../apiHandlers/prescription-guides');
const { isAutomaticOpen } = require('../services/trialUsage');

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const USER_ID = '11111111-1111-4111-8111-111111111111';
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const PROFILE = {
  id: USER_ID,
  email: 'pessoa@exemplo.com',
  current_plan: 'pro',
  billing_status: 'active',
  access_source: 'paid',
  plan_expires_at: FUTURE,
};

function jsonResponse(status, body) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installSupabase() {
  const usagePosts = [];

  global.fetch = async (url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const { pathname } = new URL(String(url));

    if (pathname === '/auth/v1/user') {
      return jsonResponse(200, { id: USER_ID, email: PROFILE.email, user_metadata: {} });
    }

    const table = pathname.replace('/rest/v1/', '');

    if (table === 'usage_logs' && method === 'POST') {
      usagePosts.push(JSON.parse(options.body));
      return jsonResponse(201, null);
    }

    if (table === 'profiles') {
      return jsonResponse(200, [PROFILE]);
    }

    return jsonResponse(200, []);
  };

  return usagePosts;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader() {},
  };
}

function buildReq(path) {
  return {
    url: path,
    method: 'GET',
    headers: { authorization: 'Bearer token-de-teste' },
  };
}

test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-teste';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste';
});

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test('isAutomaticOpen lê o auto=1 da query ou da URL, e nada mais', () => {
  assert.equal(isAutomaticOpen({ query: { auto: '1' } }), true);
  assert.equal(isAutomaticOpen({ url: '/api/clinical-drugs?slug=x&auto=1' }), true);
  assert.equal(isAutomaticOpen({ url: '/api/clinical-drugs?slug=x' }), false);
  assert.equal(isAutomaticOpen({ url: '/api/clinical-drugs?slug=x&auto=0' }), false);
  assert.equal(isAutomaticOpen({ query: { auto: 'true' } }), false);
  assert.equal(isAutomaticOpen(undefined), false);
});

const CATALOGS = [
  { nome: 'bulário', handler: clinicalDrugsHandler, path: '/api/clinical-drugs?slug=abatacepte', action: 'trial_clinical_drug' },
  { nome: 'ferramentas', handler: clinicalToolsHandler, path: '/api/clinical-tools?slug=gasometria', action: 'clinical_tool' },
  { nome: 'prescrição', handler: prescriptionGuidesHandler, path: '/api/prescription-guides?slug=abdome-agudo', action: 'trial_prescription_guide' },
];

for (const { nome, handler, path, action } of CATALOGS) {
  test(`${nome}: a abertura automática devolve o item sem registrar uso`, async () => {
    const usagePosts = installSupabase();
    const res = mockRes();

    await handler(buildReq(`${path}&auto=1`), res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.deepEqual(usagePosts, []);
  });

  test(`${nome}: o item escolhido pela pessoa registra o uso`, async () => {
    const usagePosts = installSupabase();
    const res = mockRes();

    await handler(buildReq(path), res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(usagePosts.length, 1);
    assert.equal(usagePosts[0].action, action);
    assert.equal(usagePosts[0].user_id, USER_ID);
  });
}
