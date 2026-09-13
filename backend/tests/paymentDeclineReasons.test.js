const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MOTIVO_NAO_REGISTRADO,
  describeDeclineReason,
} = require('../utils/paymentDeclineReasons');
const { buildBillingPaymentPayload } = require('../services/billingPayments');

test('código conhecido vira rótulo e orientação em português', () => {
  const motivo = describeDeclineReason('cc_rejected_insufficient_amount');

  assert.equal(motivo.codigo, 'cc_rejected_insufficient_amount');
  assert.equal(motivo.rotulo, 'Limite insuficiente');
  assert.match(motivo.orientacao, /outro cartão/);
});

test('código com espaço ou maiúscula é reconhecido', () => {
  assert.equal(describeDeclineReason('  CC_REJECTED_CALL_FOR_AUTHORIZE ').rotulo, 'Banco pediu autorização');
});

test('código desconhecido vira "Outro motivo", preservando o código', () => {
  const motivo = describeDeclineReason('cc_rejected_codigo_novo_do_mp');

  assert.equal(motivo.rotulo, 'Outro motivo');
  assert.equal(motivo.codigo, 'cc_rejected_codigo_novo_do_mp');
});

test('sem código é "não registrado", não um motivo inventado', () => {
  assert.equal(describeDeclineReason(null).codigo, MOTIVO_NAO_REGISTRADO);
  assert.equal(describeDeclineReason('').codigo, MOTIVO_NAO_REGISTRADO);
});

test('código com nome de propriedade do JavaScript não quebra a tradução', () => {
  assert.equal(describeDeclineReason('constructor').rotulo, 'Outro motivo');
  assert.equal(describeDeclineReason('__proto__').rotulo, 'Outro motivo');
});

test('antifraude tem o mesmo texto em todos os códigos, sem expor a regra', () => {
  const textos = ['cc_rejected_high_risk', 'cc_rejected_blacklist', 'rejected_high_risk']
    .map((codigo) => describeDeclineReason(codigo).orientacao);

  assert.equal(new Set(textos).size, 1);
  assert.equal(/lista|blacklist|fraude/i.test(textos[0]), false);
});

// --- gravação -------------------------------------------------------------------

test('gravação sem motivo informado não apaga o motivo já salvo', () => {
  const payload = buildBillingPaymentPayload({ paymentId: 1, status: 'approved' });

  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'status_detail'), false);
});

test('gravação com motivo informado envia o motivo; vazio vira nulo', () => {
  assert.equal(
    buildBillingPaymentPayload({ paymentId: 1, status: 'rejected', statusDetail: 'cc_rejected_other_reason' }).status_detail,
    'cc_rejected_other_reason',
  );
  assert.equal(buildBillingPaymentPayload({ paymentId: 1, status: 'rejected', statusDetail: '' }).status_detail, null);
});
