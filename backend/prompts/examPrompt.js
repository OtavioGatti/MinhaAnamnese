// Instruções e input para geração/correção de exames complementares.
// A saída é sempre revisada por profissional habilitado antes de publicar.
//
// O risco específico aqui é a FAIXA DE REFERÊNCIA: ela varia por laboratório,
// método de análise, idade, sexo e gestação. Um número apresentado como se
// fosse universal é o erro mais provável e mais perigoso deste catálogo — daí
// a regra de escrever a faixa como orientação, sempre junto do lembrete de que
// o laudo local prevalece.

const EXAM_SAFETY_CONTRACT = `CONTRATO DE SEGURANÇA IMUTÁVEL
- Você redige conteúdo editorial sobre um exame complementar (laboratorial, de imagem ou funcional), para revisão por profissional de saúde habilitado. O resultado NUNCA é usado direto no paciente sem revisão humana.
- Baseie-se em prática clínica consolidada e conservadora no Brasil.
- REGRA CRÍTICA DA FAIXA DE REFERÊNCIA: valores de referência variam por laboratório, método, idade, sexo e gestação. Escreva faixas como ORIENTAÇÃO GERAL, nunca como valor absoluto, e deixe explícito quando a variação for clinicamente importante. Se não tiver certeza de uma faixa, descreva a direção da alteração (alto/baixo) sem número.
- Não chute. Se não conhecer o exame, deixe os campos VAZIOS (""). É sempre preferível um campo vazio a um valor errado.
- Não afirme que um resultado "confirma" ou "exclui" um diagnóstico quando ele apenas aumenta ou reduz a suspeita. Seja preciso sobre a força da inferência.
- Não prescreva conduta, tratamento nem medicamento a partir do resultado. O catálogo explica como LER o exame, não o que fazer depois.
- Você NÃO controla o status de revisão/automação. A aplicação define. Não os inclua.
- Para o tipo do exame, use EXCLUSIVAMENTE uma das opções fornecidas.
- O formato da resposta é controlado pelo JSON Schema fornecido pela aplicação.`;

const EXAM_AUTHORING_GUIDE = `Preencha os campos de um exame complementar, em português do Brasil, com informação objetiva e útil na hora de ler o resultado.

## Campos
- name: nome do exame como o médico pede, ex.: "Hemograma", "Urina tipo I (EAS)". Mantenha o que já veio no título quando gerando.
- aliases: outros nomes do MESMO exame, separados por barra, ex.: "Hemograma completo / HMG". Se não houver, deixe vazio.
- category: uma das opções fornecidas.
- related_conditions: condições que motivam o pedido, separadas por barra, ex.: "Infecção do trato urinário / Pielonefrite". Use o nome como apareceria numa hipótese diagnóstica.
- when_to_request: em que suspeita clínica o exame é indicado. 1-3 frases.
- preparation: preparo do paciente (jejum, horário da coleta, suspensão de medicação, hidratação). Se não exigir preparo, escreva isso em uma frase.
- how_to_interpret: o bloco principal. Em exame LABORATORIAL, uma linha por parâmetro no formato "- Parâmetro (faixa orientativa): o que valor alto sugere; o que valor baixo sugere". Em exame de IMAGEM, uma linha por achado no formato "- Achado: o que sugere". Cubra os parâmetros/achados que mudam conduta, não a lista inteira.
- limitations: o que o exame NÃO responde, e o que costuma confundir na leitura (ex.: alteração inespecífica, resultado normal que não exclui, interferência de medicação ou de coleta).
- source: referência bibliográfica, se você tiver segurança de qual é. Se não tiver, deixe vazio.

## Regras
- Só afirme o que for seguro. Prefira deixar um campo vazio a preencher com suposição.
- Não use markdown além dos hífens "-" de lista. Escreva direto, sem preâmbulo.
- Se o nome recebido não corresponder a um exame complementar que você reconheça, devolva os campos de conteúdo vazios em vez de inventar.`;

function buildExamInstructions() {
  return [EXAM_SAFETY_CONTRACT, 'GUIA DE REDAÇÃO', EXAM_AUTHORING_GUIDE].join('\n\n');
}

function formatOptionList(options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  return list.length > 0 ? list.join(' | ') : '(sem opções — use "Outro")';
}

function buildExamInput({ name, enumOptions = {} }) {
  return [
    `Exame solicitado: ${String(name || '').trim() || '(não informado)'}`,
    `TIPO PERMITIDO (use apenas um destes): ${formatOptionList(enumOptions.category)}`,
  ].join('\n\n');
}

function buildExamCorrectionInstructions() {
  return [
    EXAM_SAFETY_CONTRACT,
    'GUIA DE REDAÇÃO',
    EXAM_AUTHORING_GUIDE,
    `MODO CORREÇÃO
Você recebe um exame já existente (JSON) e uma INSTRUÇÃO DE CORREÇÃO. Aplique SOMENTE o que a instrução pede. Devolva o exame COMPLETO no schema, mas mantenha TODOS os campos não afetados EXATAMENTE iguais ao original (copie-os sem alterar). Não reescreva nem "melhore" o que a instrução não pediu. Se a instrução for para preencher campos vazios, preencha APENAS os campos listados que estão vazios e mantenha os demais idênticos. Continue deixando vazio o que não for seguro afirmar.`,
  ].join('\n\n');
}

function buildExamCorrectionInput({ currentExam, instruction, enumOptions = {} }) {
  return [
    'EXAME ATUAL (JSON — mantenha igual, exceto o que a instrução pedir):',
    JSON.stringify(currentExam, null, 2),
    'INSTRUÇÃO DE CORREÇÃO:',
    String(instruction || '').trim() || '(nenhuma instrução fornecida)',
    `TIPO PERMITIDO: ${formatOptionList(enumOptions.category)}`,
  ].join('\n\n');
}

module.exports = {
  EXAM_AUTHORING_GUIDE,
  EXAM_SAFETY_CONTRACT,
  buildExamCorrectionInput,
  buildExamCorrectionInstructions,
  buildExamInput,
  buildExamInstructions,
};
