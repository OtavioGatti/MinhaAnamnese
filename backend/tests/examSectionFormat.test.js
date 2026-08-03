const assert = require('node:assert/strict');
const test = require('node:test');

const templates = require('../templates/templates');
const { buildStructurePrompt } = require('../prompts/structurePrompt');
const { withExamSectionGuidance, isPhysicalExamSection } = require('../utils/examSectionGuidance');

test('prompt padrão manda o exame físico sair em lista por sistema', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);

  assert.match(prompt, /UMA LINHA POR APARELHO\/SISTEMA/);
  assert.match(prompt, /AP: aparelho respiratório/);
  // a regra geral de "não usar tópicos" precisa abrir exceção, senão a IA
  // continua devolvendo o exame em parágrafo corrido (bug relatado).
  assert.match(prompt, /EXCETO na seção de exame físico/);
});

test('prompt obstétrico também abre a exceção de formato do exame', () => {
  const prompt = buildStructurePrompt(templates.obstetricia);

  assert.match(prompt, /UMA LINHA POR APARELHO\/SISTEMA/);
  assert.match(prompt, /EXCETO em Ex\. físico/);
  assert.match(prompt, /AU \(altura uterina\)/);
});

test('prompts proíbem markdown (evita negrito ao colar no PEC e-SUS)', () => {
  for (const key of ['clinica_medica', 'obstetricia']) {
    assert.match(buildStructurePrompt(templates[key]), /nada de \*\*negrito\*\*/, key);
  }
});

test('esqueleto de saída usa os rótulos abreviados do prontuário', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);
  const skeleton = prompt.split('Responda apenas com:')[1];

  for (const label of ['ID:', 'QP:', 'HDA:', 'MUC:', 'HF:', 'HV:', 'EF:']) {
    assert.ok(skeleton.includes(label), `esperava ${label} no esqueleto`);
  }
  // Sem colisão de sigla: AP é aparelho respiratório dentro do EF, então
  // antecedentes pessoais fica por extenso.
  assert.ok(skeleton.includes('Antecedentes pessoais:'));
  assert.ok(!/^\s*AP:/m.test(skeleton));
});

test('prompt explica o significado das siglas (senão a IA esvazia seções)', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);

  // Sem o glossário, "ID" e "MUC" viram rótulos opacos e o modelo devolveu
  // "ID: [Não relatado]" e jogou vacinação em MUC na verificação real.
  assert.match(prompt, /\* ID \(identificação do paciente\)/);
  assert.match(prompt, /\* MUC \(medicações em uso contínuo\)/);
  assert.match(prompt, /\* EF \(exame físico\)/);

  // A nota anti-enumeração é obrigatória: com significados longos/listados o
  // modelo copiava o glossário como sub-rótulos ("sexo [Não relatado]").
  assert.match(prompt, /NÃO reproduza esses itens na saída/);
});

test('significados das siglas são curtos (não viram checklist para a IA)', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);
  const parenteses = [...prompt.matchAll(/^\* \S+[^(\n]*\(([^)]+)\)$/gm)].map((m) => m[1]);

  assert.ok(parenteses.length > 0, 'esperava significados entre parênteses');
  parenteses.forEach((meaning) => {
    assert.ok(meaning.length <= 60, `significado longo demais: "${meaning}"`);
    assert.ok(!meaning.includes(','), `significado não deve enumerar campos: "${meaning}"`);
  });
});

test('prompt exige reescrita clínica, não apenas reorganizar/pontuar', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);

  assert.match(prompt, /é uma REESCRITA em registro clínico/);
  assert.match(prompt, /dor de cabeça -> cefaleia/);
});

test('permissão de reescrever não afrouxa a fidelidade ao relato', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);

  assert.match(prompt, /REESCREVER NÃO É ACRESCENTAR/);
  // Reescrever não pode subir a especificidade clínica do que o médico escreveu.
  assert.match(prompt, /"tontura" não vira "vertigem"/);
  assert.match(prompt, /Não inferir diagnóstico/);
});

test('regras de reescrita chegam a todos os templates de estruturação', () => {
  for (const key of Object.keys(templates)) {
    const prompt = buildStructurePrompt(templates[key]);

    assert.match(prompt, /é uma REESCRITA em registro clínico/, key);
    assert.match(prompt, /REESCREVER NÃO É ACRESCENTAR/, key);
  }
});

test('regra separa doença de medicamento citados na mesma frase', () => {
  // "HAS e DM em uso de AAS e losartana" deixava MUC vazio na verificação real.
  assert.match(buildStructurePrompt(templates.clinica_medica), /doença vai para a seção de comorbidades/);
});

test('todos os templates têm orientação de formato na seção de exame', () => {
  const examLabelByTemplate = {
    psiquiatria: 'Exame do estado mental',
    clinica_medica: 'EF',
    obstetricia: 'Ex. físico',
    upa_emergencia: 'EF direcionado',
    puerperio: 'EF',
    ginecologia: 'EF',
    triagem: 'Sinais vitais',
  };

  for (const [key, examLabel] of Object.entries(examLabelByTemplate)) {
    const guidance = templates[key].sectionGuidance;
    assert.ok(guidance, `${key} deveria ter sectionGuidance`);
    assert.ok(
      Array.isArray(guidance[examLabel]) && guidance[examLabel].length > 0,
      `${key} deveria ter guidance para "${examLabel}"`,
    );
    assert.ok(templates[key].secoes.includes(examLabel), `${key}: rótulo fora de secoes`);
  }
});

test('templates.js exporta apenas templates (constantes não vazam para o catálogo)', () => {
  // Exportar constantes junto com os templates fez elas aparecerem como opções
  // no seletor de modelo clínico do site.
  const keys = Object.keys(templates);

  assert.deepEqual(keys, [
    'psiquiatria',
    'clinica_medica',
    'obstetricia',
    'upa_emergencia',
    'puerperio',
    'ginecologia',
    'triagem',
  ]);
  keys.forEach((key) => {
    assert.ok(templates[key].nome, `${key} deveria ter nome`);
    assert.ok(Array.isArray(templates[key].secoes), `${key} deveria ter secoes`);
  });
});

test('withExamSectionGuidance cobre templates sem guidance (CMS/usuário)', () => {
  // Template que só existe no Notion/Supabase: não tem guidance hardcoded.
  const cms = withExamSectionGuidance(['Identificação', 'Queixa principal', 'Exame físico'], null);
  assert.ok(cms['Exame físico'][0].includes('uma linha por aparelho'));

  // Rótulo abreviado e variantes também são reconhecidos.
  assert.ok(withExamSectionGuidance(['EF'], null).EF);
  assert.ok(withExamSectionGuidance(['Ex. físico'], null)['Ex. físico']);
  assert.ok(withExamSectionGuidance(['Sinais vitais'], null)['Sinais vitais']);

  // Exame do estado mental recebe domínios psicopatológicos, não aparelhos.
  const mental = withExamSectionGuidance(['Exame do estado mental'], null);
  assert.match(mental['Exame do estado mental'].join(' '), /humor/);
  assert.doesNotMatch(mental['Exame do estado mental'].join(' '), /aparelho/);

  // Não sobrescreve guidance já existente nem inventa seção.
  assert.deepEqual(withExamSectionGuidance(['EF'], { EF: ['custom'] }).EF, ['custom']);
  assert.equal(withExamSectionGuidance(['QP', 'HDA'], null), null);
});

test('isPhysicalExamSection não confunde outras seções', () => {
  assert.ok(isPhysicalExamSection('EF'));
  assert.ok(isPhysicalExamSection('Exame físico direcionado'));
  assert.ok(!isPhysicalExamSection('Exames complementares'));
  assert.ok(!isPhysicalExamSection('Exame do estado mental'));
});
