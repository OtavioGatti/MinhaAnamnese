const assert = require('node:assert/strict');
const test = require('node:test');
const clinicalToolsHandler = require('../apiHandlers/clinical-tools');
const {
  FREE_CLINICAL_TOOL_SLUGS,
  isFreeClinicalToolSlug,
  resolveClinicalToolsAccess,
} = require('../config/freeClinicalTools');

const PAGA = 'analise-basica-gasometria-arterial';
const GRATUITA = 'fluidoterapia-pediatrica-manutencao';

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// A lista é fronteira comercial: crescer sem querer é dar conteúdo pago de
// graça. O teste falha de propósito se alguém acrescentar um slug sem revisar.
test('a lista de ferramentas gratuitas é exatamente a divulgada', () => {
  assert.deepEqual(FREE_CLINICAL_TOOL_SLUGS, [GRATUITA]);
});

test('isFreeClinicalToolSlug tolera caixa e espaço, e recusa o resto', () => {
  assert.equal(isFreeClinicalToolSlug(GRATUITA), true);
  assert.equal(isFreeClinicalToolSlug(`  ${GRATUITA.toUpperCase()}  `), true);
  assert.equal(isFreeClinicalToolSlug(PAGA), false);
  assert.equal(isFreeClinicalToolSlug(''), false);
  assert.equal(isFreeClinicalToolSlug(undefined), false);
});

test('assinante segue pelo fluxo normal, sem corte', () => {
  assert.deepEqual(resolveClinicalToolsAccess({ hasProAccess: true }), { mode: 'full' });
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: true, slug: PAGA }),
    { mode: 'full' },
  );
});

test('sem Pro, a gratuita passa e a paga é recusada', () => {
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: false, slug: GRATUITA }),
    { mode: 'slugs', slugs: [GRATUITA] },
  );
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: false, slug: PAGA }),
    { mode: 'denied' },
  );
});

// O vazamento mais provável: pedir várias de uma vez e levar junto uma paga.
test('sem Pro, lote misto devolve só a gratuita', () => {
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: false, slugs: [PAGA, GRATUITA, 'escore-abcd2-ait'] }),
    { mode: 'slugs', slugs: [GRATUITA] },
  );
});

test('sem Pro, lote só com pagas é recusado por inteiro', () => {
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: false, slugs: [PAGA, 'escore-abcd2-ait'] }),
    { mode: 'denied' },
  );
});

test('sem Pro, a listagem devolve apenas as liberadas', () => {
  assert.deepEqual(
    resolveClinicalToolsAccess({ hasProAccess: false }),
    { mode: 'slugs', slugs: [GRATUITA] },
  );
});

test('a listagem sem Pro nao devolve a lista interna por referencia', () => {
  const resultado = resolveClinicalToolsAccess({ hasProAccess: false });
  resultado.slugs.push('invadida');
  assert.deepEqual(FREE_CLINICAL_TOOL_SLUGS, [GRATUITA], 'a constante nao pode ser mutavel de fora');
});

// A liberação é de plano, não de login: sem sessão continua 401.
test('sem sessão continua exigindo autenticação, mesmo para a gratuita', async () => {
  const res = mockRes();
  await clinicalToolsHandler(
    { url: `/api/clinical-tools?slug=${GRATUITA}`, method: 'GET', headers: {} },
    res,
  );
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('método diferente de GET continua 405', async () => {
  const res = mockRes();
  await clinicalToolsHandler({ url: '/api/clinical-tools', method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});
