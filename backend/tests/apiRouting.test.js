const assert = require('node:assert/strict');
const test = require('node:test');
const { apiRoutes, normalizeApiPath } = require('../apiHandlers');

test('normaliza paths com e sem prefixo /api', () => {
  assert.equal(normalizeApiPath({ url: '/api/organizar' }), '/api/organizar');
  assert.equal(normalizeApiPath({ url: '/organizar' }), '/api/organizar');
  assert.equal(normalizeApiPath({ url: '/api/organizar/' }), '/api/organizar');
  assert.equal(normalizeApiPath({ url: '/api/organizar///' }), '/api/organizar');
  assert.equal(normalizeApiPath({ url: '/api/insights?foo=1' }), '/api/insights');
  assert.equal(normalizeApiPath({ url: '/api/admin/templates/sync' }), '/api/admin/templates/sync');
});

test('todas as rotas registradas apontam para handlers de função', () => {
  const paths = Object.keys(apiRoutes);

  assert.ok(paths.length > 0);

  for (const [path, handler] of Object.entries(apiRoutes)) {
    assert.ok(path.startsWith('/api/'), `rota fora do padrão: ${path}`);
    assert.equal(typeof handler, 'function', `handler inválido em: ${path}`);
  }
});

test('rotas críticas do produto continuam registradas', () => {
  const criticalRoutes = [
    '/api/organizar',
    '/api/insights',
    '/api/diagnostic-hypotheses',
    '/api/referral-letter',
    '/api/templates',
    '/api/prescription-guides',
    '/api/clinical-drugs',
    '/api/create-checkout',
    '/api/reconcile-subscription',
    '/api/webhook/mercadopago',
    '/api/health',
    '/api/affiliate',
    '/api/affiliate/lookup',
    '/api/affiliate/payouts',
    '/api/affiliate-payout-action',
    '/api/admin/affiliates/update',
    '/api/admin/affiliate-payouts/settle',
  ];

  for (const route of criticalRoutes) {
    assert.equal(typeof apiRoutes[route], 'function', `rota crítica ausente: ${route}`);
  }
});
