// Instruções e input para geração/correção de manobras de exame físico.
// A saída é sempre revisada por profissional habilitado antes de publicar.
//
// Ênfase de segurança específica de MANOBRA: o risco aqui não é dose errada, é
// (a) descrever uma técnica de um jeito que machuque o paciente e (b) afirmar
// que um achado confirma ou exclui algo que ele não confirma nem exclui. Por
// isso a regra de ouro é a mesma do bulário — deixar vazio em vez de chutar —
// mais uma proibição explícita de inventar acurácia.

const MANEUVER_SAFETY_CONTRACT = `CONTRATO DE SEGURANÇA IMUTÁVEL
- Você redige conteúdo editorial sobre uma manobra ou teste de exame físico, para revisão por profissional de saúde habilitado. O resultado NUNCA é usado direto no paciente sem revisão humana.
- Baseie-se em semiologia consolidada e conservadora, do jeito que é ensinada e praticada no Brasil.
- REGRA CRÍTICA: não chute. Se você não reconhece a manobra pelo nome, ou não tem certeza da técnica, deixe os campos VAZIOS (""). É sempre preferível um campo vazio a uma técnica errada.
- NUNCA invente número de sensibilidade, especificidade, likelihood ratio ou valor preditivo. Só cite um número se souber a fonte, e então cite a fonte no campo source. Sem fonte, descreva a utilidade em palavras.
- Não afirme que um achado "confirma" ou "exclui" um diagnóstico quando ele apenas aumenta ou reduz a suspeita. Seja preciso sobre a força da inferência.
- Descreva a técnica de forma segura: se a manobra tem risco (dor intensa, luxação, manobra contraindicada em suspeita de fratura ou instabilidade cervical), diga isso em when_to_perform.
- Você NÃO controla o status de revisão/automação. A aplicação define. Não os inclua.
- Para a região/categoria, use EXCLUSIVAMENTE uma das opções fornecidas.
- O formato da resposta é controlado pelo JSON Schema fornecido pela aplicação.`;

const MANEUVER_AUTHORING_GUIDE = `Preencha os campos de uma manobra de exame físico, em português do Brasil, com informação objetiva e fiel à semiologia.

## Campos
- name: nome consagrado da manobra, como o médico a chama, ex.: "Sinal de Giordano", "Teste da gaveta anterior". Mantenha o que já veio no título quando gerando.
- aliases: outros nomes usados para a MESMA manobra, separados por barra, ex.: "Punho-percussão lombar / Sinal de Murphy renal". Se não houver sinônimo consagrado, deixe vazio.
- category: uma das opções fornecidas (região ou especialidade).
- related_conditions: condições clínicas que motivam a manobra, separadas por barra, ex.: "Pielonefrite / Infecção do trato urinário alta". Use o nome da condição como ela aparece numa hipótese diagnóstica.
- when_to_perform: em que suspeita clínica o teste é indicado, e quando NÃO fazer (contraindicação ou situação em que ele é pouco confiável). 1-3 frases.
- how_to_perform: execução passo a passo — posição do paciente, posição do examinador, o movimento aplicado, e o que comparar. Objetivo, sem enfeite.
- positive_finding: o que caracteriza o achado positivo e o que ele sugere. Seja preciso sobre a força da inferência (sugere / é compatível com / aumenta a suspeita de).
- negative_finding: o que um achado negativo significa — e, quando for o caso, deixe explícito que negativo não exclui o diagnóstico.
- clinical_utility: se a manobra serve mais para reforçar a suspeita, mais para afastar, ou nenhum dos dois; e limitações práticas (dor, contratura, obesidade, fase aguda). Números só com fonte.
- source: referência bibliográfica, se você tiver segurança de qual é. Se não tiver, deixe vazio.

## Regras
- Só afirme o que for seguro. Prefira deixar um campo vazio a preencher com suposição.
- Não use markdown além dos hífens "-" de lista. Escreva direto, sem preâmbulo.
- Se o nome recebido não corresponder a uma manobra de exame físico que você reconheça, devolva os campos de conteúdo vazios em vez de inventar uma técnica.`;

function buildManeuverInstructions() {
  return [MANEUVER_SAFETY_CONTRACT, 'GUIA DE REDAÇÃO', MANEUVER_AUTHORING_GUIDE].join('\n\n');
}

function formatOptionList(options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  return list.length > 0 ? list.join(' | ') : '(sem opções — use "Outro")';
}

function buildManeuverInput({ name, enumOptions = {} }) {
  return [
    `Manobra solicitada: ${String(name || '').trim() || '(não informada)'}`,
    `REGIÃO/CATEGORIA PERMITIDA (use apenas uma destas): ${formatOptionList(enumOptions.category)}`,
  ].join('\n\n');
}

function buildManeuverCorrectionInstructions() {
  return [
    MANEUVER_SAFETY_CONTRACT,
    'GUIA DE REDAÇÃO',
    MANEUVER_AUTHORING_GUIDE,
    `MODO CORREÇÃO
Você recebe uma manobra já existente (JSON) e uma INSTRUÇÃO DE CORREÇÃO. Aplique SOMENTE o que a instrução pede. Devolva a manobra COMPLETA no schema, mas mantenha TODOS os campos não afetados EXATAMENTE iguais ao original (copie-os sem alterar). Não reescreva nem "melhore" o que a instrução não pediu. Se a instrução for para preencher campos vazios, preencha APENAS os campos listados que estão vazios e mantenha os demais idênticos. Continue deixando vazio o que não for seguro afirmar.`,
  ].join('\n\n');
}

function buildManeuverCorrectionInput({ currentManeuver, instruction, enumOptions = {} }) {
  return [
    'MANOBRA ATUAL (JSON — mantenha igual, exceto o que a instrução pedir):',
    JSON.stringify(currentManeuver, null, 2),
    'INSTRUÇÃO DE CORREÇÃO:',
    String(instruction || '').trim() || '(nenhuma instrução fornecida)',
    `REGIÃO/CATEGORIA PERMITIDA: ${formatOptionList(enumOptions.category)}`,
  ].join('\n\n');
}

module.exports = {
  MANEUVER_AUTHORING_GUIDE,
  MANEUVER_SAFETY_CONTRACT,
  buildManeuverCorrectionInput,
  buildManeuverCorrectionInstructions,
  buildManeuverInput,
  buildManeuverInstructions,
};
