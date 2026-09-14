const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Lógica pura dos eventos de checkout do frontend (ESM), testada daqui porque o
// frontend não tem suíte própria.
const MODULO = pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'checkoutTracking.js')).href;

test('tipo do erro ao criar o checkout sai do status, nunca da mensagem', async () => {
  const { classifyCheckoutFailure } = await import(MODULO);

  assert.equal(classifyCheckoutFailure({ success: false, status: 0, error: 'Failed to fetch' }), 'rede');
  assert.equal(classifyCheckoutFailure({ success: false, status: 400 }), 'dados_invalidos');
  assert.equal(classifyCheckoutFailure({ success: false, status: 401 }), 'sessao');
  assert.equal(classifyCheckoutFailure({ success: false, status: 429 }), 'limite');
  assert.equal(classifyCheckoutFailure({ success: false, status: 502 }), 'provedor');
  assert.equal(classifyCheckoutFailure({ success: false, status: 503 }), 'configuracao');
  assert.equal(classifyCheckoutFailure({ success: false, status: 500 }), 'servidor');
  assert.equal(classifyCheckoutFailure({ success: true, status: 200, data: {} }), 'sem_link');
  assert.equal(classifyCheckoutFailure(null), 'rede');
});

test('retorno do Mercado Pago: sucesso, pendente e falha; o resto não é retorno', async () => {
  const { normalizeCheckoutReturnStatus } = await import(MODULO);

  assert.equal(normalizeCheckoutReturnStatus('success'), 'success');
  // Bug conhecido do retorno de assinatura: "?checkout=success?preapproval_id=..."
  assert.equal(normalizeCheckoutReturnStatus('success?preapproval_id=abc'), 'success');
  assert.equal(normalizeCheckoutReturnStatus('pending'), 'pending');
  assert.equal(normalizeCheckoutReturnStatus('FAILURE'), 'failure');
  assert.equal(normalizeCheckoutReturnStatus('qualquer'), null);
  assert.equal(normalizeCheckoutReturnStatus(null), null);
});

test('a ida ao Mercado Pago espera o registro no máximo o tempo definido', async () => {
  const { waitAtMost } = await import(MODULO);
  const nuncaTermina = new Promise(() => {});
  const inicio = Date.now();

  await waitAtMost(nuncaTermina, 50);

  assert.ok(Date.now() - inicio < 1000, 'não pode travar a ida ao pagamento');
});
