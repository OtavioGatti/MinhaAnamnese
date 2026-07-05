const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyAutomationLock,
  finalizeAutomationProtocol,
  LOCKED_STATUS_REVISAO,
  STATUS_AUTOMACAO_GERADO,
  LOCKED_REVISOR,
} = require('../contracts/protocolAutomation');

// Esta suíte é a GARANTIA DE SEGURANÇA do pipeline: nenhum fluxo automático
// pode marcar um protocolo como pronto/revisado, aconteça o que acontecer.

test('applyAutomationLock anula tentativa de marcar pronto/revisado', () => {
  const hostil = {
    titulo: 'ITU não complicada',
    pronto_para_supabase: true,
    status_revisao: 'Revisado',
    revisor: 'Dr. Fulano',
    status_automacao: 'pronto',
  };

  const locked = applyAutomationLock(hostil);

  assert.equal(locked.pronto_para_supabase, false);
  assert.equal(typeof locked.pronto_para_supabase, 'boolean'); // boolean nativo, nunca string
  assert.equal(locked.status_revisao, LOCKED_STATUS_REVISAO);
  assert.equal(locked.revisor, LOCKED_REVISOR);
  assert.equal(locked.status_automacao, STATUS_AUTOMACAO_GERADO);

  // Campos não travados são preservados.
  assert.equal(locked.titulo, 'ITU não complicada');
});

test('reproduz o bug antigo: string "Não — revisão clínica pendente" vira boolean false', () => {
  const locked = applyAutomationLock({ pronto_para_supabase: 'Não — revisão clínica pendente' });

  assert.equal(locked.pronto_para_supabase, false);
  assert.equal(typeof locked.pronto_para_supabase, 'boolean');
});

test('finalizeAutomationProtocol aplica a trava mesmo com saída hostil do modelo', () => {
  const raw = {
    titulo: 'Cefaleia tensional',
    pronto_para_supabase: true,
    status_revisao: 'Aprovado pela equipe',
    revisor: 'Equipe clínica',
    status_automacao: 'concluido',
    resumo_clinico: 'Resumo qualquer',
  };

  const finalized = finalizeAutomationProtocol(raw, {});

  assert.equal(finalized.pronto_para_supabase, false);
  assert.equal(finalized.status_revisao, LOCKED_STATUS_REVISAO);
  assert.equal(finalized.revisor, '');
  assert.equal(finalized.status_automacao, STATUS_AUTOMACAO_GERADO);
  assert.equal(finalized.titulo, 'Cefaleia tensional');
});

test('a trava é idempotente e não depende dos campos existirem na entrada', () => {
  const locked = applyAutomationLock({});

  assert.equal(locked.pronto_para_supabase, false);
  assert.equal(locked.status_revisao, LOCKED_STATUS_REVISAO);
  assert.equal(locked.revisor, '');
  assert.equal(locked.status_automacao, STATUS_AUTOMACAO_GERADO);
});
