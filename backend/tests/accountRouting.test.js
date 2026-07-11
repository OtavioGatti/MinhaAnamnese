const assert = require('node:assert/strict');
const test = require('node:test');
const accountHandler = require('../apiHandlers/account');

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

test('export exige GET (POST vira 405)', async () => {
  const res = mockRes();
  await accountHandler({ url: '/api/account/export', method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('delete exige POST (GET vira 405)', async () => {
  const res = mockRes();
  await accountHandler({ url: '/api/account/delete', method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('caminho desconhecido em /account vira 404', async () => {
  const res = mockRes();
  await accountHandler({ url: '/api/account/qualquer', method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 404);
});

test('export sem sessão exige autenticação (401)', async () => {
  const res = mockRes();
  await accountHandler({ url: '/api/account/export', method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('delete sem sessão exige autenticação (401)', async () => {
  const res = mockRes();
  await accountHandler({ url: '/api/account/delete', method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 401);
});
