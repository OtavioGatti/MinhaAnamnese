const assert = require('node:assert/strict');
const test = require('node:test');

const { buildChatModelParams, isReasoningModel, resolveModelChoice } = require('../utils/openaiModels');
const { resolveInsightsModel } = require('../services/generateInsights');
const { resolveLettersModel } = require('../services/letters');

test('modelos de raciocínio recebem reasoning none e max_completion_tokens, sem temperature', () => {
  assert.equal(isReasoningModel('gpt-6-luna'), true);
  assert.equal(isReasoningModel('gpt-5.4-mini'), true);
  assert.equal(isReasoningModel('gpt-4o'), false);
  assert.equal(isReasoningModel('gpt-4.1'), false);
  assert.deepEqual(buildChatModelParams('gpt-6-luna', { temperature: 0, topP: 1, maxTokens: 2200 }), { model: 'gpt-6-luna', reasoning_effort: 'none', max_completion_tokens: 2200 });
  assert.deepEqual(buildChatModelParams('gpt-4o', { temperature: 0, topP: 1, maxTokens: 2200 }), { model: 'gpt-4o', temperature: 0, top_p: 1, max_tokens: 2200 });
});

test('variável do Render vence o CMS; valor sem cara de modelo é ignorado', () => {
  assert.equal(resolveModelChoice({ envValue: 'gpt-6-luna', cmsValue: 'gpt-4o', fallback: 'x' }), 'gpt-6-luna');
  assert.equal(resolveModelChoice({ envValue: '', cmsValue: 'gpt-4o', fallback: 'x' }), 'gpt-4o');
  assert.equal(resolveModelChoice({ envValue: 'lixo; drop', cmsValue: '', fallback: 'gpt-4o-mini' }), 'gpt-4o-mini');
});

test('avaliação completa e cartas seguem nos modelos atuais até a variável ser trocada', () => {
  const anteriores = { i: process.env.INSIGHTS_MODEL, l: process.env.LETTERS_MODEL };
  delete process.env.INSIGHTS_MODEL;
  delete process.env.LETTERS_MODEL;

  try {
    assert.equal(resolveInsightsModel(''), 'gpt-4o');
    assert.equal(resolveLettersModel(), 'gpt-4o-mini');
    process.env.INSIGHTS_MODEL = 'gpt-6-luna';
    process.env.LETTERS_MODEL = 'gpt-5.4-mini';
    assert.equal(resolveInsightsModel('gpt-4o'), 'gpt-6-luna');
    assert.equal(resolveLettersModel(), 'gpt-5.4-mini');
  } finally {
    for (const [k, v] of [['INSIGHTS_MODEL', anteriores.i], ['LETTERS_MODEL', anteriores.l]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('palavra de outro alfabeto na saída é detectada, salvo se já vinha no texto', () => {
  const { hasUnexpectedForeignScript } = require('../utils/openaiModels');

  assert.equal(hasUnexpectedForeignScript('Não realizou os exames da consulta السابقة.', 'não fez os exames'), true);
  assert.equal(hasUnexpectedForeignScript('Paciente com dor torácica há 2 dias, PA 120x80 mmHg.', ''), false);
  assert.equal(hasUnexpectedForeignScript('Paciente refere 头痛.', 'paciente chinesa refere 头痛'), false);
  assert.equal(hasUnexpectedForeignScript('Ação, coração, pé, ü, ñ, °C, µg', ''), false);
});
