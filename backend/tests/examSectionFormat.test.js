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

test('negativa consolidada fica em frase própria (escopo sem ambiguidade)', () => {
  // A consolidação de "Nega" é desejada, mas misturar afirmado e negado na mesma
  // frase faz o motor de hipóteses ler achado ausente como sintoma ativo.
  for (const key of Object.keys(templates)) {
    const prompt = buildStructurePrompt(templates[key]);

    assert.match(prompt, /CONSOLIDAÇÃO DE NEGATIVAS/, key);
    assert.match(prompt, /Manter a negativa em FRASE PRÓPRIA/, key);
    assert.match(prompt, /Nunca misturar achados afirmados e negados na mesma frase/, key);
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
  // Sem depender da posição: a ordem importa para o modelo (a restrição vem
  // primeiro), mas o teste aqui é só que a orientação de formato chegou.
  assert.match(cms['Exame físico'].join(' '), /uma linha por aparelho/);
  assert.match(cms['Exame físico'].join(' '), /nunca escrever \[Não relatado\] por sistema/);

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

// A regra "não enumerar, senão vira checklist" já existia para o glossário de
// siglas (teste acima), mas só olhava linhas iniciadas por "* ". A lista de
// sistemas do exame usa "  - " e escapou: enumerava 7 descritores de
// NORMALIDADE em "Estado geral (BEG, corado, hidratado, acianótico...)".
// Resultado medido contra o modelo real: linha fantasma em sistema não
// examinado ("AC: [Não relatado]") em 6 de 14 rodadas.
test('lista de sistemas do exame não enumera achados (senão vira checklist)', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);
  // Só a lista de siglas: as orientações por seção (sectionGuidance) também
  // usam "  - " e não fazem parte desta regra.
  const apos = prompt.slice(prompt.indexOf('* Ordem e grafia das siglas'));
  const itens = [];

  for (const linha of apos.split(/\r?\n/).slice(1)) {
    const item = /^ {2}- (.+)$/.exec(linha);

    if (!item) {
      break;
    }

    itens.push(item[1].trim());
  }

  assert.ok(itens.length >= 5, `esperava a lista de sistemas, veio ${itens.length}`);

  itens.forEach((item) => {
    assert.ok(!item.includes(','), `sistema não deve enumerar achados: "${item}"`);
    assert.ok(item.length <= 40, `descrição longa demais vira exemplo a copiar: "${item}"`);
  });
});

// Sem esta regra o modelo aplica às linhas do exame a instrução de seção vazia
// que vem do CMS ("use [Não relatado] para seções vazias") — as duas usam a
// mesma sintaxe "RÓTULO:", e ele não distingue uma da outra.
test('exame proíbe marcador de ausência por linha de sistema', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);
  const bloco = prompt.slice(prompt.indexOf('FORMATO DA SEÇÃO DE EXAME FÍSICO'));

  assert.match(bloco, /NUNCA escrever \[Não relatado\]/);
  assert.match(bloco, /valem para SEÇÕES inteiras/);
  assert.match(bloco, /A LINHA SÓ EXISTE SE/);
});

test('a lista de siglas se declara ordem e grafia, não checklist', () => {
  const prompt = buildStructurePrompt(templates.clinica_medica);

  assert.match(prompt, /NÃO É CHECKLIST/);
});

// A correção precisa valer para todo template, não só clínica médica — os
// prompts do CMS recebem estas regras pelo token clinical_writing_rules.
test('proibição de linha fantasma chega a todos os templates', () => {
  Object.values(templates).forEach((template) => {
    if (!template || !Array.isArray(template.secoes)) {
      return;
    }

    const prompt = buildStructurePrompt(template);

    assert.match(
      prompt,
      /NUNCA escrever \[Não relatado\]/,
      `template sem a proibição: ${template.nome || template.id}`,
    );
  });
});

// Caso real relatado pelo dono, reproduzido 2/2 contra o modelo antes da
// correção: o médico escreveu "C+P: Tireoide..." e "AP: Murmúrios abolidos em
// base, estertorando difusamente". Como C+P não estava na lista de siglas, o
// modelo forçou a tireoide em AP e SOBRESCREVEU o achado pulmonar — que
// simplesmente sumiu. Achado alterado desaparecendo é o pior defeito possível
// aqui, então a regra de não descartar/fundir vem ANTES de tudo na orientação.
test('exame proíbe descartar ou fundir achado, e manda manter rótulo fora da lista', () => {
  const guidance = withExamSectionGuidance(['EF'], null).EF.join(' ');

  assert.match(guidance, /NUNCA descartar nem fundir achado/);
  assert.match(guidance, /MANTENHA o rótulo original do médico/);
  assert.match(guidance, /nunca junte dois sistemas na mesma linha/);
});

test('a lista de siglas se declara aberta e inclui os sistemas que faltavam', () => {
  const guidance = withExamSectionGuidance(['EF'], null).EF.join(' ');

  // "estado geral" e "C+P" faltavam: sem casa na lista, o conteúdo deles era
  // empurrado para a sigla mais parecida.
  assert.match(guidance, /Estado geral/);
  assert.match(guidance, /C\+P/);
  assert.match(guidance, /NÃO é lista fechada/);
});

test('a regra de segurança chega a todos os templates', () => {
  Object.values(templates).forEach((template) => {
    if (!template || !Array.isArray(template.secoes)) {
      return;
    }

    assert.match(
      buildStructurePrompt(template),
      /NUNCA descartar nem fundir achado/,
      `template sem a regra: ${template.nome || template.id}`,
    );
  });
});
