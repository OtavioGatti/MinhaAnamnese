// Instruções e input para geração/correção de ferramentas clínicas.
//
// O risco aqui é diferente do de manobras/exames: a saída é LÓGICA, não prosa.
// Uma pontuação trocada ou um ponto de corte errado não "parece" errado na
// revisão — devolve um número plausível. Daí as duas regras que mais importam
// no prompt: (1) só instrumento consagrado, reproduzido como publicado, nunca
// adaptado ou inventado; (2) a fórmula só pode citar ids de campo declarados.

const {
  ALLOWED_FORMULA_FUNCTIONS,
  AUTOMATABLE_ENGINE_TYPES,
} = require('../contracts/clinicalToolAutomation');

const TOOL_SAFETY_CONTRACT = `CONTRATO DE SEGURANÇA IMUTÁVEL
- Você transcreve para JSON um instrumento clínico JÁ EXISTENTE e consagrado na literatura (score, escala ou calculadora), para revisão por profissional de saúde habilitado antes de qualquer uso.
- NUNCA invente um instrumento, nem crie pontuações, pesos ou pontos de corte "razoáveis". Você está TRANSCREVENDO algo publicado, não projetando algo novo.
- Se você não souber com segurança a pontuação exata de cada item e os pontos de corte oficiais do instrumento pedido, devolva "fields" como lista VAZIA. Uma ferramenta vazia é recuperável; uma com pontuação errada devolve um número plausível e errado, e isso pode mudar conduta.
- Não adapte, não simplifique e não "melhore" o instrumento. Reproduza os itens e os pesos como publicados. Se a versão validada em português diferir da original, use a validada em português e diga qual é em source_reference.
- Não inclua conduta terapêutica nem dose de medicamento nas orientações das faixas. A ferramenta classifica risco/gravidade; o que fazer depois é do protocolo clínico.
- Você NÃO controla status de publicação nem de revisão. A aplicação define. Não os inclua.
- O formato da resposta é controlado pelo JSON Schema fornecido pela aplicação.`;

const TOOL_AUTHORING_GUIDE = `Preencha a definição de uma ferramenta clínica, em português do Brasil.

## Campos de identificação
- title: nome do instrumento como o médico o chama, incluindo a sigla, ex.: "Escore de Centor para faringite estreptocócica".
- slug: identificador em kebab-case sem acento, derivado do título, ex.: "escore-de-centor".
- category / subcategory: use EXCLUSIVAMENTE uma das opções fornecidas.
- description: 1-2 frases dizendo o que a ferramenta estima e em quem se aplica.
- source_reference: a referência do instrumento (autor/ano ou diretriz). Se não tiver segurança, deixe vazio.
- search_tags: termos de busca separados por barra, incluindo sinônimos e a sigla.

## Tipo de motor (tool_type)
- SOMA_PONTOS: o resultado é a soma dos pontos das opções escolhidas (Centor, CHA2DS2-VASc, PHQ-9, Wells...). É o caso mais comum.
- FORMULA_MATEMATICA: o resultado vem de uma conta sobre valores numéricos (IMC, clearance, TFG...).

## fields (as perguntas)
- id: identificador curto em snake_case, sem acento, ÚNICO na ferramenta, ex.: "idade", "exsudato_tonsilar". A fórmula só pode citar esses ids.
- label: a pergunta como aparece na tela.
- input_type: "select" ou "radio" para escolha única; "checkbox" para múltipla; "number" para valor numérico digitado.
- options: obrigatório em select/radio/checkbox. Cada opção tem label, value (snake_case) e numeric_value (os PONTOS que ela vale — 0 quando não pontua).
- Em input_type "number": deixe options como lista vazia e preencha unit (ex.: "kg", "anos", "mg/dL") e, quando fizer sentido, min/max/step. Em todos os outros, deixe min/max/step como null.
- helper_text: só quando o item precisa de critério explícito para ser respondido igual por pessoas diferentes (ex.: o que conta como "exsudato"). Caso contrário, vazio.

## engine_config
- Em SOMA_PONTOS: deixe formula vazia, precision 0, e use score_label (ex.: "pontos") e result_label (ex.: "Escore de Centor").
- Em FORMULA_MATEMATICA: formula é uma expressão que cita SOMENTE ids de campo declarados em fields e, se necessário, estas funções: ${ALLOWED_FORMULA_FUNCTIONS.join(', ')}. Use precision conforme o instrumento (ex.: 1 para IMC), unit a unidade do resultado (ex.: "kg/m²") e result_label o nome do resultado.
- A fórmula NÃO pode conter "=" de atribuição, nem nome de campo que não exista em fields. Isso é verificado pela aplicação e reprova a geração.

## result_ranges (a classificação)
- Uma faixa por estrato oficial do instrumento, com min e max INCLUSIVOS na escala do resultado.
- As faixas precisam cobrir TODO o intervalo possível, do menor ao maior resultado alcançável — inclusive o extremo mais grave. Use null em min (ou max) para faixa aberta.
- classification: o rótulo do estrato ("Baixo risco", "Depressão moderada").
- alert_color: green (tranquilizador), yellow (atenção), red (grave/urgente), blue ou gray (neutro).
- orientation: o que aquele estrato significa em termos de risco/probabilidade, como o instrumento descreve. Sem conduta e sem medicamento.

## Regra final
Se o instrumento pedido não for um que você conhece com precisão item a item, devolva fields e result_ranges vazios em vez de aproximar.`;

function buildClinicalToolInstructions() {
  return [TOOL_SAFETY_CONTRACT, 'GUIA DE PREENCHIMENTO', TOOL_AUTHORING_GUIDE].join('\n\n');
}

function formatOptionList(options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  return list.length > 0 ? list.join(' | ') : '(sem opções — use "Outro")';
}

function buildClinicalToolInput({ name, enumOptions = {} }) {
  return [
    `Ferramenta solicitada: ${String(name || '').trim() || '(não informada)'}`,
    `CATEGORIA PERMITIDA (use apenas uma destas): ${formatOptionList(enumOptions.category)}`,
    `SUBCATEGORIA PERMITIDA (use apenas uma destas): ${formatOptionList(enumOptions.subcategory)}`,
    `TIPO DE MOTOR PERMITIDO: ${AUTOMATABLE_ENGINE_TYPES.join(' | ')}`,
  ].join('\n\n');
}

function buildClinicalToolCorrectionInstructions() {
  return [
    TOOL_SAFETY_CONTRACT,
    'GUIA DE PREENCHIMENTO',
    TOOL_AUTHORING_GUIDE,
    `MODO CORREÇÃO
Você recebe uma ferramenta já existente (JSON) e uma INSTRUÇÃO DE CORREÇÃO. Aplique SOMENTE o que a instrução pede. Devolva a ferramenta COMPLETA no schema, mantendo TODOS os campos não afetados EXATAMENTE iguais ao original (copie-os sem alterar).
Atenção especial: se você mexer em pontuação de opção, em fórmula ou em ponto de corte, a mudança precisa vir do instrumento publicado, não do seu julgamento. Se a instrução pedir algo que não bate com o instrumento original, mantenha o original.
Quando a instrução vier de ERROS DE VALIDAÇÃO da aplicação, corrija exatamente o que os erros apontam — em geral é id de campo citado na fórmula que não existe, ou faixa de resultado que não cobre a pontuação máxima possível.`,
  ].join('\n\n');
}

function buildClinicalToolCorrectionInput({ currentTool, instruction, enumOptions = {} }) {
  return [
    'FERRAMENTA ATUAL (JSON — mantenha igual, exceto o que a instrução pedir):',
    JSON.stringify(currentTool, null, 2),
    'INSTRUÇÃO DE CORREÇÃO:',
    String(instruction || '').trim() || '(nenhuma instrução fornecida)',
    `CATEGORIA PERMITIDA: ${formatOptionList(enumOptions.category)}`,
    `SUBCATEGORIA PERMITIDA: ${formatOptionList(enumOptions.subcategory)}`,
  ].join('\n\n');
}

module.exports = {
  TOOL_AUTHORING_GUIDE,
  TOOL_SAFETY_CONTRACT,
  buildClinicalToolCorrectionInput,
  buildClinicalToolCorrectionInstructions,
  buildClinicalToolInput,
  buildClinicalToolInstructions,
};
