const assert = require('node:assert/strict');
const test = require('node:test');

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { buildProfileFallback } = require('../services/profiles');
const organizar = require('../apiHandlers/organizar');
const profileHandler = require('../apiHandlers/profile');
const { buildLeadsCsv, toLead } = require('../services/leads');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function fakeRes() {
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

// --- celular no perfil --------------------------------------------------------

test('primeiro perfil pega o celular e o aceite do WhatsApp do cadastro', () => {
  const user = {
    id: USER_ID,
    email: 'a@b.com',
    user_metadata: { phone: '(11) 98765-4321', whatsapp_opt_in: true, whatsapp_opt_in_at: '2026-10-14T12:00:00.000Z' },
  };
  const profile = buildProfileFallback(user, null);

  assert.equal(profile.phone, '11987654321');
  assert.equal(profile.whatsapp_opt_in_at, '2026-10-14T12:00:00.000Z');
  assert.ok(profile.phone_collected_at);
});

test('sem aceite no cadastro o WhatsApp fica de fora; número inválido no metadata é ignorado', () => {
  const semAceite = buildProfileFallback({ id: USER_ID, user_metadata: { phone: '11987654321', whatsapp_opt_in: false } }, null);
  assert.equal(semAceite.phone, '11987654321');
  assert.equal(semAceite.whatsapp_opt_in_at, null);

  const invalido = buildProfileFallback({ id: USER_ID, user_metadata: { phone: '1234' } }, null);
  assert.equal(invalido.phone, null);
  assert.equal(invalido.phone_collected_at, null);
});

test('depois de gravado, o metadata não troca mais o celular (só o perfil troca)', () => {
  const existente = {
    id: USER_ID,
    phone: '11987654321',
    phone_collected_at: '2026-10-01T00:00:00.000Z',
    whatsapp_opt_in_at: null,
  };
  const user = { id: USER_ID, user_metadata: { phone: '21998765432', whatsapp_opt_in: true } };

  const semMudanca = buildProfileFallback(user, existente);
  assert.equal(semMudanca.phone, '11987654321');
  assert.equal(semMudanca.phone_collected_at, '2026-10-01T00:00:00.000Z');
  assert.equal(semMudanca.whatsapp_opt_in_at, null);

  const trocado = buildProfileFallback(user, existente, { phone: '21998765432' });
  assert.equal(trocado.phone, '21998765432');
  assert.notEqual(trocado.phone_collected_at, '2026-10-01T00:00:00.000Z');
});

test('aceite do WhatsApp: o perfil liga e retira explicitamente', () => {
  const existente = { id: USER_ID, phone: '11987654321', whatsapp_opt_in_at: '2026-10-01T00:00:00.000Z' };
  const user = { id: USER_ID, user_metadata: {} };

  assert.equal(buildProfileFallback(user, existente, { whatsapp_opt_in_at: null }).whatsapp_opt_in_at, null);
  assert.equal(
    buildProfileFallback(user, { ...existente, whatsapp_opt_in_at: null }, { whatsapp_opt_in_at: '2026-10-14T00:00:00.000Z' }).whatsapp_opt_in_at,
    '2026-10-14T00:00:00.000Z',
  );
  // ausente = não mexe
  assert.equal(buildProfileFallback(user, existente, { whatsapp_opt_in_at: undefined }).whatsapp_opt_in_at, '2026-10-01T00:00:00.000Z');
});

test('perfil recusa celular inválido antes de qualquer outra coisa', async () => {
  const res = fakeRes();
  await profileHandler({ method: 'POST', headers: {}, body: { phone: '(11) 3456-7890' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /celular válido/);
});

// --- organizar só com conta ----------------------------------------------------

test('chave ORGANIZE_LOGIN_REQUIRED só liga com "true"', () => {
  const anterior = process.env.ORGANIZE_LOGIN_REQUIRED;

  for (const [valor, esperado] of [['true', true], ['TRUE', true], ['', false], ['false', false], ['1', false]]) {
    process.env.ORGANIZE_LOGIN_REQUIRED = valor;
    assert.equal(organizar.isOrganizeLoginRequired(), esperado, valor);
  }

  delete process.env.ORGANIZE_LOGIN_REQUIRED;
  assert.equal(organizar.isOrganizeLoginRequired(), false);

  if (anterior !== undefined) {
    process.env.ORGANIZE_LOGIN_REQUIRED = anterior;
  }
});

test('com a chave ligada, organizar sem conta devolve 401 antes de chamar a IA', async () => {
  const anterior = process.env.ORGANIZE_LOGIN_REQUIRED;
  process.env.ORGANIZE_LOGIN_REQUIRED = 'true';

  try {
    const res = fakeRes();
    await organizar(
      { method: 'POST', headers: {}, body: { template: 'clinica_medica', texto: 'Dor torácica há 2 dias.' } },
      res,
    );

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'LOGIN_REQUIRED');
    assert.match(res.body.error, /conta grátis/);
  } finally {
    if (anterior === undefined) {
      delete process.env.ORGANIZE_LOGIN_REQUIRED;
    } else {
      process.env.ORGANIZE_LOGIN_REQUIRED = anterior;
    }
  }
});

// --- leads ---------------------------------------------------------------------

test('lead sai com celular formatado, link do WhatsApp e datas no fuso de Brasília', () => {
  const lead = toLead({
    email: 'a@b.com',
    display_name: 'Ana',
    phone: '11987654321',
    whatsapp_opt_in_at: '2026-10-14T02:00:00.000Z',
    created_at: '2026-10-14T02:00:00.000Z',
    current_plan: 'pro',
    access_source: 'trial',
  });

  assert.equal(lead.celular, '+55 (11) 98765-4321');
  assert.equal(lead.whatsapp, 'https://wa.me/5511987654321');
  assert.equal(lead.aceitaWhatsapp, true);
  // 02h UTC de 14/10 ainda é 13/10 em Brasília
  assert.equal(lead.cadastro, '13/10/2026');
});

test('CSV abre no Excel em português: BOM, ponto e vírgula e aspas escapadas', () => {
  const csv = buildLeadsCsv([
    toLead({ email: 'a@b.com', display_name: 'Silva; "Ana"', phone: '11987654321' }),
  ]);

  assert.ok(csv.startsWith('﻿'));
  const [cabecalho, linha] = csv.slice(1).split('\r\n');
  assert.ok(cabecalho.startsWith('E-mail;Nome;Celular'));
  assert.ok(linha.includes('"Silva; ""Ana"""'));
  assert.ok(linha.includes(';não;'));
});
