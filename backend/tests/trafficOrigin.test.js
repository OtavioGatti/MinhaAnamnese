const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'trafficOrigin.js')).href;
const UA_TIKTOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_33.1.0 BytedanceWebview/d8a21c6';
const UA_INSTAGRAM = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Instagram 310.0.0.0';
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

test('utm_source do link manda, com apelidos normalizados', async () => {
  const { classifyTrafficOrigin } = await import(MODULO);
  assert.deepEqual(classifyTrafficOrigin({ search: '?utm_source=tt&utm_campaign=Matheus_Out', userAgent: UA_CHROME }), { canal: 'tiktok', utm_source: 'tiktok', utm_campaign: 'matheus_out', ref_host: null });
  assert.equal(classifyTrafficOrigin({ search: '?utm_source=IG' }).canal, 'instagram');
  assert.equal(classifyTrafficOrigin({ search: '?utm_source=newsletter' }).canal, 'newsletter');
});

test('navegador interno do TikTok e do Instagram é reconhecido mesmo sem referrer', async () => {
  const { classifyTrafficOrigin } = await import(MODULO);
  assert.equal(classifyTrafficOrigin({ userAgent: UA_TIKTOK }).canal, 'tiktok');
  assert.equal(classifyTrafficOrigin({ userAgent: UA_INSTAGRAM }).canal, 'instagram');
});

test('domínio de origem vira canal; o próprio site e a ausência viram direto', async () => {
  const { classifyTrafficOrigin } = await import(MODULO);
  assert.equal(classifyTrafficOrigin({ referrer: 'https://l.instagram.com/?u=x', userAgent: UA_CHROME }).canal, 'instagram');
  assert.equal(classifyTrafficOrigin({ referrer: 'https://www.google.com.br/', userAgent: UA_CHROME }).canal, 'google');
  assert.equal(classifyTrafficOrigin({ referrer: 'https://www.tiktok.com/@perfil', userAgent: UA_CHROME }).canal, 'tiktok');
  const outro = classifyTrafficOrigin({ referrer: 'https://blogmedico.com.br/post/1', userAgent: UA_CHROME });
  assert.deepEqual([outro.canal, outro.ref_host], ['outro', 'blogmedico.com.br']);
  assert.equal(classifyTrafficOrigin({ referrer: 'https://minhaanamnese.com.br/x', ownHost: 'minhaanamnese.com.br', userAgent: UA_CHROME }).canal, 'direto');
  assert.equal(classifyTrafficOrigin({ userAgent: UA_CHROME }).canal, 'direto');
  assert.equal(classifyTrafficOrigin({ search: '?ref=matheus', userAgent: UA_CHROME }).canal, 'afiliado');
});

test('visita direta não apaga a origem de 30 dias; canal novo substitui', async () => {
  const { resolveStoredOrigin } = await import(MODULO);
  const dia = 24 * 60 * 60 * 1000;
  const agora = Date.UTC(2026, 9, 16);
  const tiktok = { canal: 'tiktok', ts: agora - 5 * dia };
  assert.equal(resolveStoredOrigin({ current: { canal: 'direto' }, stored: tiktok, now: agora }).canal, 'tiktok');
  assert.equal(resolveStoredOrigin({ current: { canal: 'direto' }, stored: { canal: 'tiktok', ts: agora - 31 * dia }, now: agora }).canal, 'direto');
  assert.equal(resolveStoredOrigin({ current: { canal: 'instagram' }, stored: tiktok, now: agora }).canal, 'instagram');
});

test('perfil grava a origem do cadastro uma vez e não troca depois', () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { buildProfileFallback } = require('../services/profiles');
  const user = { id: '11111111-1111-4111-8111-111111111111', user_metadata: { signup_origin: 'TikTok', signup_campaign: 'matheus_out' } };

  const novo = buildProfileFallback(user, null);
  assert.equal(novo.signup_origin, 'tiktok');
  assert.equal(novo.signup_campaign, 'matheus_out');

  const existente = buildProfileFallback({ ...user, user_metadata: { signup_origin: 'instagram' } }, { id: user.id, signup_origin: 'tiktok' });
  assert.equal(existente.signup_origin, 'tiktok');
});
