const assert = require('node:assert/strict');
const test = require('node:test');

// Força o fallback em memória para não depender de Supabase nos testes.
process.env.RATE_LIMIT_STORE = 'memory';

const { consumeRateLimit, getClientIp } = require('../utils/rateLimit');

function fakeReq(ip = '203.0.113.10') {
  return { headers: { 'x-forwarded-for': ip } };
}

test('permite até o limite e bloqueia a partir dele', async () => {
  const options = {
    req: fakeReq(),
    scope: `test_block_${Date.now()}`,
    limit: 3,
    windowMs: 60_000,
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await consumeRateLimit(options);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 3 - attempt);
  }

  const blocked = await consumeRateLimit(options);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test('janela expirada reinicia a contagem', async () => {
  const options = {
    req: fakeReq(),
    scope: `test_window_${Date.now()}`,
    limit: 1,
    windowMs: 20,
  };

  assert.equal((await consumeRateLimit(options)).allowed, true);
  assert.equal((await consumeRateLimit(options)).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal((await consumeRateLimit(options)).allowed, true);
});

test('identidades diferentes têm buckets separados', async () => {
  const base = {
    scope: `test_identity_${Date.now()}`,
    limit: 1,
    windowMs: 60_000,
  };

  assert.equal((await consumeRateLimit({ ...base, req: fakeReq('198.51.100.1') })).allowed, true);
  assert.equal((await consumeRateLimit({ ...base, req: fakeReq('198.51.100.2') })).allowed, true);
  assert.equal(
    (await consumeRateLimit({ ...base, req: fakeReq('198.51.100.1'), userId: 'user-a' })).allowed,
    true,
  );
  assert.equal((await consumeRateLimit({ ...base, req: fakeReq('198.51.100.1') })).allowed, false);
});

test('getClientIp prioriza o primeiro IP de x-forwarded-for', () => {
  assert.equal(
    getClientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }),
    '203.0.113.7',
  );
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
  assert.equal(getClientIp({ headers: {} }), 'unknown');
});
