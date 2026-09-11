const assert = require('node:assert/strict');
const test = require('node:test');

// Sem banco configurado: prova a degradação para o comportamento anterior.
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const {
  buildReferralClaimRequest,
  claimAffiliateReferral,
  getStoredReferralAffiliate,
  normalizeReferralSource,
  pickCheckoutAffiliate,
  resolveAffiliateForCheckout,
  summarizeReferral,
} = require('../services/affiliates');

const COMPRADOR = '11111111-1111-4111-8111-111111111111';
const DONO_MATHEUS = '22222222-2222-4222-8222-222222222222';
const DONO_LUCAS = '33333333-3333-4333-8333-333333333333';

function afiliado(code, userId, extra = {}) {
  return {
    id: `${code}-id`,
    code,
    user_id: userId,
    status: 'active',
    discount_rate: 0.1,
    discount_label: null,
    commission_rate: 0.3,
    ...extra,
  };
}

// --- precedência no checkout ------------------------------------------------

// Primeiro contato vence: quem trouxe a pessoa não perde a comissão porque ela
// digitou outro código na última hora.
test('indicação salva na conta vence o código do navegador', () => {
  const escolha = pickCheckoutAffiliate({
    storedAffiliate: afiliado('matheusmacari', DONO_MATHEUS),
    requestedAffiliate: afiliado('lucas', DONO_LUCAS),
    buyerUserId: COMPRADOR,
  });

  assert.equal(escolha.affiliate.code, 'matheusmacari');
  assert.equal(escolha.origin, 'stored');
});

test('sem indicação salva, vale o código enviado pelo navegador', () => {
  const escolha = pickCheckoutAffiliate({
    storedAffiliate: null,
    requestedAffiliate: afiliado('lucas', DONO_LUCAS),
    buyerUserId: COMPRADOR,
  });

  assert.equal(escolha.affiliate.code, 'lucas');
  assert.equal(escolha.origin, 'requested');
});

test('auto-indicação nunca vale, em nenhuma das duas fontes', () => {
  const proprio = afiliado('eumesmo', COMPRADOR);

  const soSalva = pickCheckoutAffiliate({
    storedAffiliate: proprio,
    requestedAffiliate: afiliado('lucas', DONO_LUCAS),
    buyerUserId: COMPRADOR,
  });
  assert.equal(soSalva.affiliate.code, 'lucas', 'indicação salva de si mesmo é ignorada');

  const ambas = pickCheckoutAffiliate({
    storedAffiliate: proprio,
    requestedAffiliate: proprio,
    buyerUserId: COMPRADOR,
  });
  assert.equal(ambas.affiliate, null);
});

test('afiliado pausado não vale, e o próximo da fila assume', () => {
  const escolha = pickCheckoutAffiliate({
    storedAffiliate: afiliado('matheusmacari', DONO_MATHEUS, { status: 'paused' }),
    requestedAffiliate: afiliado('lucas', DONO_LUCAS),
    buyerUserId: COMPRADOR,
  });

  assert.equal(escolha.affiliate.code, 'lucas');
});

test('sem nenhuma indicação, preço cheio', () => {
  const escolha = pickCheckoutAffiliate({
    storedAffiliate: null,
    requestedAffiliate: null,
    buyerUserId: COMPRADOR,
  });

  assert.deepEqual(escolha, { affiliate: null, origin: null });
});

// --- gravação write-once ------------------------------------------------------

// O filtro is.null é a garantia: se a conta já tem indicação, o PATCH não casa
// nenhuma linha. Sem ele, um segundo checkout trocaria o afiliado.
test('a gravação só casa conta que ainda não tem indicação', () => {
  const agora = new Date('2026-09-11T15:00:00Z');
  const { path, body } = buildReferralClaimRequest({
    userId: COMPRADOR,
    affiliateId: 'af-1',
    source: 'codigo',
    now: agora,
  });

  assert.match(path, /^profiles\?/);
  assert.match(path, new RegExp(`id=eq\\.${COMPRADOR}`));
  assert.match(path, /referred_by_affiliate_id=is\.null/);
  assert.deepEqual(body, {
    referred_by_affiliate_id: 'af-1',
    referred_at: '2026-09-11T15:00:00.000Z',
    referral_source: 'codigo',
  });
});

test('origem desconhecida vira link; as válidas são preservadas', () => {
  assert.equal(normalizeReferralSource('codigo'), 'codigo');
  assert.equal(normalizeReferralSource('ADMIN'), 'admin');
  assert.equal(normalizeReferralSource('link'), 'link');
  assert.equal(normalizeReferralSource('qualquer-coisa'), 'link');
  assert.equal(normalizeReferralSource(null), 'link');
});

// --- o que a tela recebe --------------------------------------------------------

test('a tela recebe só código e desconto, nunca dado do afiliado', () => {
  const resumo = summarizeReferral(afiliado('matheusmacari', DONO_MATHEUS));

  assert.deepEqual(resumo, {
    code: 'matheusmacari',
    discountRate: 0.1,
    discountLabel: null,
  });
  assert.equal(summarizeReferral(null), null);
});

// --- degradação antes do SQL --------------------------------------------------

test('auto-indicação é recusada antes de tocar no banco', async () => {
  const resultado = await claimAffiliateReferral({
    userId: COMPRADOR,
    affiliate: afiliado('eumesmo', COMPRADOR),
    source: 'link',
  });

  assert.deepEqual(resultado, { claimed: false });
});

test('sem banco, a gravação falha em silêncio', async () => {
  const resultado = await claimAffiliateReferral({
    userId: COMPRADOR,
    affiliate: afiliado('matheusmacari', DONO_MATHEUS),
    source: 'link',
  });

  assert.deepEqual(resultado, { claimed: false, unavailable: true });
});

test('sem banco, a leitura da indicação vira "sem indicação"', async () => {
  assert.equal(await getStoredReferralAffiliate(COMPRADOR), null);
});

// Enquanto o SQL não for aplicado, o checkout tem que se comportar como antes:
// sem afiliado resolvido, preço cheio, e sem quebrar a compra.
test('sem banco, o checkout segue sem afiliado e sem quebrar', async () => {
  const afiliadoResolvido = await resolveAffiliateForCheckout({
    affiliateCode: 'matheusmacari',
    affiliateCodeSource: 'codigo',
    buyerUserId: COMPRADOR,
    sourceUrl: 'https://minhaanamnese.com.br/',
  });

  assert.equal(afiliadoResolvido, null);
});
