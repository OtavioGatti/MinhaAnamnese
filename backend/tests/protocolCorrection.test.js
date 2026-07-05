const assert = require('node:assert/strict');
const test = require('node:test');
const {
  diffChangedFields,
  pickCurrentProtocol,
} = require('../services/correctProtocol');
const {
  applyAutomationLock,
  STATUS_AUTOMACAO_CORRIGIDO,
  LOCKED_STATUS_REVISAO,
} = require('../contracts/protocolAutomation');

test('pickCurrentProtocol lê arrays para multi_select e strings para texto', () => {
  const fields = {
    titulo: 'ITU — Adulto',
    resumo_clinico: 'Resumo',
    especialidade: ['Clínica Médica'],
    tags: ['itu', 'cistite'],
    tipo_protocolo: 'Ambulatorial',
    // campos ausentes viram '' ou []
  };

  const current = pickCurrentProtocol(fields);
  assert.equal(current.titulo, 'ITU — Adulto');
  assert.deepEqual(current.especialidade, ['Clínica Médica']);
  assert.deepEqual(current.tags, ['itu', 'cistite']);
  assert.equal(current.contexto === undefined, false); // existe como []
  assert.deepEqual(current.contexto, []);
  assert.equal(current.subcondicao, '');
});

test('diffChangedFields detecta só os campos realmente alterados', () => {
  const current = {
    titulo: 'ITU', resumo_clinico: 'Antigo', especialidade: ['A'], tags: ['x'],
  };
  const next = {
    titulo: 'ITU', resumo_clinico: 'Novo', especialidade: ['A'], tags: ['x', 'y'],
  };

  const changed = diffChangedFields(current, next);
  assert.ok(changed.includes('resumo_clinico'));
  assert.ok(changed.includes('tags'));
  assert.ok(!changed.includes('titulo'));
  assert.ok(!changed.includes('especialidade'));
});

test('correção reaplica a trava com status "corrigido — aguardando revisão"', () => {
  const corrected = applyAutomationLock(
    { titulo: 'X', pronto_para_supabase: true, status_revisao: 'Revisado' },
    { statusAutomacao: STATUS_AUTOMACAO_CORRIGIDO },
  );

  assert.equal(corrected.status_automacao, STATUS_AUTOMACAO_CORRIGIDO);
  assert.equal(corrected.pronto_para_supabase, false);
  assert.equal(corrected.status_revisao, LOCKED_STATUS_REVISAO);
  assert.equal(corrected.revisor, '');
});
