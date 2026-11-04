const assert = require('node:assert/strict');
const test = require('node:test');

// Força o fallback em memória para não depender de Supabase nos testes.
process.env.RATE_LIMIT_STORE = 'memory';

const express = require('express');

const { TRUST_PROXY_SETTING, consumeRateLimit, getClientIp } = require('../utils/rateLimit');

async function resolveIpThroughExpress(forwardedFor) {
  const app = express();
  app.set('trust proxy', TRUST_PROXY_SETTING);
  app.get('/', (req, res) => res.json({ ip: getClientIp(req) }));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    });
    return (await response.json()).ip;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

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

test('getClientIp usa req.ip do Express e ignora x-forwarded-for forjado', () => {
  // Atrás do Render, o cliente manda "203.0.113.7" e o proxy anexa o IP real;
  // o Express (trust proxy) resolve req.ip para o IP real.
  assert.equal(
    getClientIp({ ip: '198.51.100.9', headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.9' } }),
    '198.51.100.9',
  );
  assert.equal(getClientIp({ ip: '198.51.100.9', headers: { 'x-forwarded-for': '203.0.113.7' } }), '198.51.100.9');
});

test('getClientIp sem Express fica com a última entrada de x-forwarded-for', () => {
  assert.equal(
    getClientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }),
    '10.0.0.1',
  );
  assert.equal(getClientIp({ headers: { 'x-forwarded-for': ' , 203.0.113.7 , ' } }), '203.0.113.7');
  assert.equal(getClientIp({ headers: { 'x-real-ip': '192.0.2.5' } }), '192.0.2.5');
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
  assert.equal(getClientIp({ headers: {} }), 'unknown');
});

test('x-forwarded-for forjado não abre um bucket novo quando há req.ip', async () => {
  const base = {
    scope: `test_spoof_${Date.now()}`,
    limit: 1,
    windowMs: 60_000,
  };
  const realIp = '198.51.100.20';

  assert.equal(
    (await consumeRateLimit({ ...base, req: { ip: realIp, headers: {} } })).allowed,
    true,
  );
  assert.equal(
    (await consumeRateLimit({
      ...base,
      req: { ip: realIp, headers: { 'x-forwarded-for': '203.0.113.99' } },
    })).allowed,
    false,
  );
});

test('com o trust proxy do server.js, req.ip pula a Cloudflare e os proxies do Render', async () => {
  // Cadeia real observada em produção: cliente, IP da Cloudflare, hops 10.x.
  assert.equal(await resolveIpThroughExpress('203.0.113.7, 172.71.151.133, 10.198.21.52'), '203.0.113.7');
  assert.equal(await resolveIpThroughExpress('203.0.113.7, 104.22.10.172, 10.198.21.52, 10.196.83.205'), '203.0.113.7');
  assert.equal(await resolveIpThroughExpress('203.0.113.7, 10.198.21.52'), '203.0.113.7');
  // Valor forjado pelo cliente fica à esquerda do IP real e é ignorado.
  assert.equal(await resolveIpThroughExpress('198.51.100.4, 203.0.113.7, 172.71.151.3, 10.198.21.52'), '203.0.113.7');
  // IPv6 da Cloudflare também é pulado.
  assert.equal(await resolveIpThroughExpress('203.0.113.7, 2606:4700::1111, 10.198.21.52'), '203.0.113.7');
  // Sem proxy nenhum (local), fica o IP do socket.
  assert.equal(await resolveIpThroughExpress(null), '127.0.0.1');
});
