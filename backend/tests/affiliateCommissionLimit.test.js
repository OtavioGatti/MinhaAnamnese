const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeCommissionMaxCount,
  resolveCommissionLimitDecision,
} = require('../services/affiliates');

function decide(maxCount, hasLimitMarker, commissionCount) {
  return resolveCommissionLimitDecision({ maxCount, hasLimitMarker, commissionCount });
}

test('sem teto configurado a comissão é vitalícia (comportamento atual)', () => {
  // A coluna pode nem existir antes do SQL ser aplicado.
  for (const semLimite of [null, undefined, 0, -3, '', 'abc']) {
    const decisao = decide(semLimite, false, 12);

    assert.equal(decisao.allowed, true, String(semLimite));
    assert.equal(decisao.shouldRegister, false, String(semLimite));
    assert.equal(decisao.reason, 'no_limit', String(semLimite));
  }
});

test('normalizeCommissionMaxCount aceita só inteiro positivo', () => {
  assert.equal(normalizeCommissionMaxCount(6), 6);
  assert.equal(normalizeCommissionMaxCount('6'), 6);
  assert.equal(normalizeCommissionMaxCount(0), null);
  assert.equal(normalizeCommissionMaxCount(-1), null);
  assert.equal(normalizeCommissionMaxCount(null), null);
  assert.equal(normalizeCommissionMaxCount('abc'), null);
});

test('primeira comissão do par entra na contagem e registra o marcador', () => {
  const decisao = decide(6, false, 0);

  assert.equal(decisao.allowed, true);
  assert.equal(decisao.shouldRegister, true);
  assert.equal(decisao.reason, 'first_commission');
});

test('libera até a última comissão e bloqueia a seguinte', () => {
  // Teto 6: a contagem recebida é o que JÁ existe, sem o pagamento atual.
  // Com 5 comissões, a atual é a 6ª e ainda passa.
  for (let jaExistentes = 0; jaExistentes < 6; jaExistentes += 1) {
    const decisao = decide(6, true, jaExistentes);

    assert.equal(decisao.allowed, true, `${jaExistentes} existentes`);
    assert.equal(decisao.reason, 'within_limit', `${jaExistentes} existentes`);
  }

  // Com 6 já pagas, a 7ª não sai.
  const bloqueada = decide(6, true, 6);
  assert.equal(bloqueada.allowed, false);
  assert.equal(bloqueada.shouldRegister, false);
  assert.equal(bloqueada.reason, 'limit_reached');
});

test('não gera comissão além do teto mesmo com contagem acima do esperado', () => {
  // Defensivo: se por algum motivo houver mais comissões que o teto, continua bloqueado.
  assert.equal(decide(6, true, 9).allowed, false);
  assert.equal(decide(1, true, 1).allowed, false);
});

test('teto de 1 libera exatamente uma comissão', () => {
  const primeira = decide(1, false, 0);
  assert.equal(primeira.allowed, true);
  assert.equal(primeira.shouldRegister, true);

  assert.equal(decide(1, true, 1).allowed, false);
});

test('par anterior à regra segue vitalício mesmo se o afiliado ganhar teto depois', () => {
  // Sem marcador mas com histórico: indicado antes da regra existir.
  const decisao = decide(6, false, 20);

  assert.equal(decisao.allowed, true);
  assert.equal(decisao.shouldRegister, false);
  assert.equal(decisao.reason, 'legacy_pair');
});

test('contagem inválida não bloqueia indevidamente', () => {
  // Falha de parsing do content-range não pode virar bloqueio silencioso.
  for (const invalida of [null, undefined, NaN, -5, 'x']) {
    const decisao = decide(6, true, invalida);

    assert.equal(decisao.allowed, true, String(invalida));
    assert.equal(decisao.reason, 'within_limit', String(invalida));
  }
});

test('reprocessar o mesmo pagamento não consome vaga extra', () => {
  // O webhook é idempotente por payment_id: no reprocessamento a contagem já
  // inclui a comissão daquele pagamento, então a decisão só precisa não estourar.
  const aposPrimeira = decide(6, true, 1);
  assert.equal(aposPrimeira.allowed, true);
  assert.equal(aposPrimeira.shouldRegister, false);
});
