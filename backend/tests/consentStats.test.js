const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'consentStats.js')).href;
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'consent_stats.sql'), 'utf8');

const UA_INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 606502013)';
const UA_INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Instagram 310.0.0.0';
const UA_FACEBOOK_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.106;FBBV/600000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBLC/pt_BR]';
const UA_TIKTOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_33.1.0 BytedanceWebview/d8a21c6';
const UA_SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const UA_CHROME_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Valores aceitos pela função do banco: o que sair do front fora dessa lista é
// ignorado em silêncio, então os dois lados precisam andar juntos.
function sqlList(coluna) {
  const match = SQL.match(new RegExp(`${coluna} text not null check \\(${coluna} in \\(([^)]*)\\)\\)`));
  assert.ok(match, `lista de ${coluna} não encontrada no SQL`);
  return match[1].split(',').map((valor) => valor.trim().replace(/'/g, ''));
}

test('origem vem só do utm_source da chegada', async () => {
  const { classifyConsentOrigin } = await import(MODULO);
  const anuncio = '?utm_source=meta&utm_medium=paid&utm_campaign=teste01&utm_content=V_B_varfarina_25s&fbclid=TESTE';
  assert.equal(classifyConsentOrigin(anuncio), 'meta');
  assert.equal(classifyConsentOrigin('?utm_source=Facebook'), 'meta');
  assert.equal(classifyConsentOrigin('?utm_source=instagram&utm_campaign=bio'), 'meta');
  assert.equal(classifyConsentOrigin('?utm_source=IG'), 'meta');
  assert.equal(classifyConsentOrigin('?utm_source=google&utm_medium=cpc'), 'google');
  assert.equal(classifyConsentOrigin('?gclid=abc'), 'organico');
  assert.equal(classifyConsentOrigin(''), 'organico');
  assert.equal(classifyConsentOrigin('?utm_source='), 'organico');
  assert.equal(classifyConsentOrigin('?utm_source=tiktok'), 'outro');
  assert.equal(classifyConsentOrigin('?utm_source=diagnostico'), 'outro');
});

test('dispositivo e navegador interno saem do user agent, reduzidos a uma palavra', async () => {
  const { classifyConsentContext } = await import(MODULO);
  const casos = [
    [UA_INSTAGRAM_IOS, 'celular', 'instagram'],
    [UA_INSTAGRAM_ANDROID, 'celular', 'instagram'],
    [UA_FACEBOOK_IOS, 'celular', 'facebook'],
    [UA_TIKTOK, 'celular', 'tiktok'],
    [UA_SAFARI_IPHONE, 'celular', 'nenhum'],
    [UA_CHROME_ANDROID, 'celular', 'nenhum'],
    [UA_CHROME_DESKTOP, 'desktop', 'nenhum'],
    ['', 'desktop', 'nenhum'],
  ];

  for (const [userAgent, dispositivo, navegadorInterno] of casos) {
    const contexto = classifyConsentContext({ search: '', userAgent });
    assert.deepEqual(contexto, { origem: 'organico', dispositivo, navegador_interno: navegadorInterno }, userAgent);
  }
});

test('o contexto leva só as três chaves anônimas, nada do user agent nem do link', async () => {
  const { classifyConsentContext } = await import(MODULO);
  const contexto = classifyConsentContext({
    search: '?utm_source=meta&utm_campaign=teste01&fbclid=TESTE',
    userAgent: UA_INSTAGRAM_IOS,
  });
  assert.deepEqual(Object.keys(contexto).sort(), ['dispositivo', 'navegador_interno', 'origem']);
  assert.ok(!JSON.stringify(contexto).includes('TESTE'));
  assert.ok(!JSON.stringify(contexto).includes('teste01'));
  assert.ok(!JSON.stringify(contexto).includes('iPhone'));
});

test('tudo o que o front pode mandar está nas listas do SQL', async () => {
  const { classifyConsentContext } = await import(MODULO);
  const origens = new Set();
  const dispositivos = new Set();
  const navegadores = new Set();
  const buscas = ['', '?utm_source=meta', '?utm_source=google', '?utm_source=outra'];
  const agentes = [UA_INSTAGRAM_IOS, UA_FACEBOOK_IOS, UA_TIKTOK, UA_SAFARI_IPHONE, UA_CHROME_DESKTOP];

  for (const search of buscas) {
    for (const userAgent of agentes) {
      const contexto = classifyConsentContext({ search, userAgent });
      origens.add(contexto.origem);
      dispositivos.add(contexto.dispositivo);
      navegadores.add(contexto.navegador_interno);
    }
  }

  assert.deepEqual([...origens].sort(), sqlList('origem').sort());
  assert.deepEqual([...dispositivos].sort(), sqlList('dispositivo').sort());
  assert.deepEqual([...navegadores].sort(), sqlList('navegador_interno').sort());
  assert.deepEqual(sqlList('evento').sort(), ['aceitou', 'mostrado', 'recusou']);
});

test('no máximo 1 "mostrado" por carga; decisão só conta depois da exibição e uma vez', async () => {
  const { createConsentStatsCounter } = await import(MODULO);
  const contexto = { origem: 'meta', dispositivo: 'celular', navegador_interno: 'instagram' };

  const enviados = [];
  const contador = createConsentStatsCounter({ send: (evento, ctx) => enviados.push([evento, ctx]) });
  assert.equal(contador.decision('accepted'), false, 'decisão sem exibição contada não soma');
  assert.equal(contador.shown(contexto), true);
  assert.equal(contador.shown(contexto), false);
  assert.equal(contador.decision('accepted'), true);
  assert.equal(contador.decision('rejected'), false);
  assert.deepEqual(enviados, [['mostrado', contexto], ['aceitou', contexto]]);

  const recusa = [];
  const outro = createConsentStatsCounter({ send: (evento) => recusa.push(evento) });
  outro.shown(contexto);
  assert.equal(outro.decision('qualquer'), false);
  outro.decision('rejected');
  assert.deepEqual(recusa, ['mostrado', 'recusou']);
});

test('o envio chama só a função de soma, com as quatro palavras', async () => {
  const { sendConsentStat } = await import(MODULO);
  const chamadas = [];
  const cliente = { rpc: (nome, args) => { chamadas.push([nome, args]); return Promise.resolve({ error: null }); } };
  sendConsentStat(cliente, 'mostrado', { origem: 'meta', dispositivo: 'celular', navegador_interno: 'instagram' });
  assert.deepEqual(chamadas, [[
    'consent_stats_increment',
    { p_evento: 'mostrado', p_origem: 'meta', p_dispositivo: 'celular', p_navegador_interno: 'instagram' },
  ]]);

  // Cliente sem rpc (Supabase não configurado) ou erro de rede: não quebra nada.
  assert.doesNotThrow(() => sendConsentStat({}, 'mostrado', { origem: 'meta' }));
  assert.doesNotThrow(() => sendConsentStat({ rpc: () => Promise.reject(new Error('rede')) }, 'aceitou', { origem: 'meta' }));
  assert.doesNotThrow(() => sendConsentStat({ rpc: () => { throw new Error('sincrono'); } }, 'aceitou', { origem: 'meta' }));
});

test('o SQL não guarda nada que identifique a pessoa', () => {
  const tabela = SQL.match(/create table if not exists public\.consent_stats \(([\s\S]*?)\n\);/);
  assert.ok(tabela);
  const colunas = tabela[1].split('\n').map((linha) => linha.trim().split(/\s+/)[0]).filter((nome) => nome && nome !== 'primary');
  assert.deepEqual(colunas, ['dia', 'evento', 'origem', 'dispositivo', 'navegador_interno', 'quantidade']);
  assert.match(SQL, /revoke all on table public\.consent_stats from public, anon, authenticated/);
  assert.match(SQL, /revoke all on table public\.v_consent_resumo from public, anon, authenticated/);
  assert.match(SQL, /with \(security_invoker = true\)/);
  assert.match(SQL, /grant execute on function public\.consent_stats_increment\(text, text, text, text\) to anon;/);
});
