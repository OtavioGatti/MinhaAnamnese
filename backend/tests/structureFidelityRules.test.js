const assert = require('node:assert/strict');
const test = require('node:test');

const templates = require('../templates/templates');
const { buildStructurePrompt } = require('../prompts/structurePrompt');
const { IMMUTABLE_SAFETY_CONTRACT } = require('../prompts/diagnosticHypothesesPrompt');

// Em produção o prompt vem do CMS e só recebe as regras do código pelos
// tokens. As regras de fidelidade precisam chegar por esse caminho também.
const CMS_PROMPT = 'Prompt editorial.\n{{clinical_writing_rules}}\n{{interpretive_field_rules}}\n{{output_skeleton}}';

function promptDoCms(templateConfig) {
  return buildStructurePrompt(templateConfig, { categoryPrompt: CMS_PROMPT });
}

test('queixa dita como falta sai como afirmação, não como negativa', () => {
  // "dorme mal" saía "Nega dormir bem" em 10 de 10 rodadas na clínica médica.
  const prompt = promptDoCms(templates.clinica_medica);

  assert.match(prompt, /QUEIXA DITA COMO FALTA NÃO É NEGATIVA/);
  assert.match(prompt, /"dorme mal" -> "Refere sono de má qualidade\."/);
  assert.match(prompt, /nunca "Nega dormir bem"/);
  assert.match(prompt, /Não usar negativa genérica para preencher seção/);
});

test('remédio sai da frase da comorbidade em qualquer forma de escrever', () => {
  // "hipertenso, usa losartana" deixava a losartana nos antecedentes e o MUC vazio.
  const prompt = promptDoCms(templates.clinica_medica);

  assert.match(prompt, /"hipertenso, usa losartana" -> antecedentes: "Hipertensão arterial\." \/ medicações: "Losartana\."/);
  assert.match(prompt, /SEM o nome do remédio/);
});

test('regra de completude: nenhum fato do texto original some', () => {
  // "trabalhou a vida toda na roça" sumia em 10 de 10 rodadas.
  assert.match(promptDoCms(templates.clinica_medica), /Nenhum fato do texto original pode sumir da saída/);
});

test('seção de conduta entra na trava de campos interpretativos', () => {
  const prompt = promptDoCms({ nome: 'Teste', secoes: ['ID', 'HMA', 'HD/Problemas ativos', 'Conduta'] });
  const bloco = prompt.slice(prompt.indexOf('CAMPOS INTERPRETATIVOS SENSÍVEIS'));

  assert.match(bloco, /\* Conduta\n/);
  assert.match(bloco, /\* HD\/Problemas ativos\n/);
  assert.match(bloco, /Não sugerir conduta, investigação, exame ou encaminhamento/);
});

test('o bloco interpretativo usa o mesmo marcador que os prompts do CMS', () => {
  const prompt = promptDoCms(templates.clinica_medica);
  const bloco = prompt.slice(prompt.indexOf('CAMPOS INTERPRETATIVOS SENSÍVEIS'));

  assert.match(bloco, /usar \[Não relatado\]/);
  assert.doesNotMatch(bloco, /usar \[INFORMAÇÃO INSUFICIENTE\]/);
});

test('hipóteses: problema documentado não ganha qualificador que o texto não traz', () => {
  // "Dor lombar há 6 semanas" virava "Dor Lombar Crônica" em 7 de 10 rodadas.
  assert.match(IMMUTABLE_SAFETY_CONTRACT, /FIDELIDADE DO PROBLEMA DOCUMENTADO/);
  assert.match(IMMUTABLE_SAFETY_CONTRACT, /nunca "Dor Lombar Crônica"/);
  assert.match(IMMUTABLE_SAFETY_CONTRACT, /não aumente nem reduza a intensidade, a frequência ou a resposta a tratamento/);
});
