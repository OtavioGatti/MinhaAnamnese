const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Caminho do navegador até o Supabase (frontend, ESM), testado daqui porque o
// frontend não tem suíte própria.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'supabaseRoute.js')).href;
const SUPABASE = 'https://uzwuctjfhjopgjkqahqz.supabase.co';
const SITE = 'https://minhaanamnese.com.br';

test('o atalho troca só o endereço do Supabase, mantendo caminho e parâmetros', async () => {
  const { toProxyUrl } = await import(MODULO);

  assert.equal(
    toProxyUrl(`${SUPABASE}/auth/v1/token?grant_type=password`, { supabaseUrl: SUPABASE, origin: SITE }),
    `${SITE}/sb/auth/v1/token?grant_type=password`,
  );
  assert.equal(toProxyUrl(`${SUPABASE}/`, { supabaseUrl: `${SUPABASE}/`, origin: `${SITE}/` }), `${SITE}/sb/`);
});

test('endereço que não é do Supabase passa intacto', async () => {
  const { toProxyUrl } = await import(MODULO);

  assert.equal(toProxyUrl('https://api.mercadopago.com/v1/x', { supabaseUrl: SUPABASE, origin: SITE }), 'https://api.mercadopago.com/v1/x');
  // Prefixo parecido não conta como o mesmo endereço.
  assert.equal(toProxyUrl(`${SUPABASE}.evil.com/x`, { supabaseUrl: SUPABASE, origin: SITE }), `${SUPABASE}.evil.com/x`);
});

test('só o desvio fica guardado, e vence em 12 horas', async () => {
  const { readStoredRoute, serializeStoredRoute, SUPABASE_ROUTE_TTL_MS } = await import(MODULO);
  const agora = Date.parse('2026-09-23T12:00:00Z');

  assert.equal(readStoredRoute(serializeStoredRoute(agora), agora + 60 * 1000), 'proxy');
  assert.equal(readStoredRoute(serializeStoredRoute(agora), agora + SUPABASE_ROUTE_TTL_MS + 1), null, 'depois do prazo, testa de novo');
  assert.equal(readStoredRoute(JSON.stringify({ rota: 'direto', em: agora }), agora), null, 'direto nunca fica guardado');
  assert.equal(readStoredRoute('lixo', agora), null);
  assert.equal(readStoredRoute(null, agora), null);
});

// Sem a regra de repasse na Vercel, /sb/... devolve a página do site (HTML,
// 200). Desviar para lá deixaria a pessoa sem login.
test('o atalho só conta como funcionando se quem respondeu foi o Supabase', async () => {
  const { isSupabaseHealthResponse } = await import(MODULO);

  assert.equal(isSupabaseHealthResponse({
    ok: true,
    contentType: 'application/json',
    body: '{"version":"v2.197.0","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}',
  }), true);
  assert.equal(isSupabaseHealthResponse({ ok: true, contentType: 'text/html', body: '<!doctype html><div id="root"></div>' }), false);
  assert.equal(isSupabaseHealthResponse({ ok: false, contentType: 'application/json', body: '{"message":"No API key found"}' }), false);
});
