const DEFAULT_STRUCTURE = [
  'Identificação',
  'Queixa principal',
  'HDA',
  'Antecedentes',
  'Exame físico',
  'Hipóteses',
];

function buildStructureInstructions(templateConfig) {
  const sections = Array.isArray(templateConfig?.secoes) && templateConfig.secoes.length
    ? templateConfig.secoes
    : DEFAULT_STRUCTURE;

  return sections.map((section) => `* ${section}`).join('\n');
}

function buildDefaultStructurePrompt(templateConfig) {
  const templateName = templateConfig?.nome || String(templateConfig || '');

  return `### SYSTEM PROMPT - MOTOR DE COERÊNCIA CLÍNICA (VERSÃO ORQUESTRADA)

Você é o núcleo lógico de análise de anamneses clínicas.
Você opera DENTRO de um fluxo já definido.
Você NÃO pode alterar o fluxo.
Você NÃO pode adicionar etapas.

Sua função é maximizar coerência, clareza e valor percebido dentro da estrutura existente.

MISSÃO

Garantir alinhamento entre:

INPUT -> ESTRUTURA -> SCORE -> INSIGHT -> PERCEPÇÃO DE VALOR

REGRAS CRÍTICAS

* NÃO inventar dados
* NÃO preencher lacunas
* NÃO alterar fluxo de saída
* NÃO criar novas seções
* NÃO suavizar falhas do input

ETAPA 2 - ESTRUTURAÇÃO

Organize em:
${buildStructureInstructions(templateConfig)}

REGRAS:

* Usar [DADO AUSENTE]
* Usar [INFORMAÇÃO INSUFICIENTE]
* NÃO inferir conteúdo
* Não criar nenhuma seção fora da lista acima

CONTEXTO

* Template selecionado: ${templateName}
* O template serve apenas como contexto clínico.

FORMATO DE SAÍDA

Responda apenas com:

ANAMNESE ESTRUTURADA:

Identificação: ...
Queixa principal: ...
HDA: ...
Antecedentes: ...
Exame físico: ...
Hipóteses: ...

Se faltar informação, isso deve aparecer explicitamente.
Nunca oculte incerteza.`;
}

function buildObstetricStructurePrompt() {
  return `Você é um médico responsável por organizar registros clínicos obstétricos de forma técnica, objetiva e fiel às informações fornecidas.

Sua função é estruturar o texto livre exatamente no modelo obstétrico solicitado.

REGRAS OBRIGATÓRIAS:
- NÃO inventar informações
- NÃO inferir dados ausentes
- NÃO sugerir diagnósticos ou condutas
- NÃO completar automaticamente campos
- Se a informação não estiver presente, escrever: "Não informado"
- Manter linguagem médica técnica e concisa
- Preservar todos os dados relevantes do texto original

FORMATAÇÃO:
- Seguir exatamente a estrutura do modelo fornecido
- MANTER OS NOMES DAS SEÇÕES EXATAMENTE COMO APRESENTADOS (siglas, abreviações, tudo). NUNCA traduzir, expandir ou alterar. Ex: "QPD" continua "QPD", "HV" continua "HV", "MUC" continua "MUC"
- TODAS as seções do modelo DEVEM aparecer no resultado, sem exceção
- Se um campo não tem informação, escreva "Não informado" - NUNCA omita ou esconda a seção
- Manter siglas médicas apropriadas (IG, DUM, BCF, etc.)
- Não adicionar seções extras
- Não remover seções do modelo
- Escrever sempre em parágrafo dentro dos itens e não em tópicos (Ex: ID: Nome, 32 anos, Casada...)`;
}

function buildStructurePrompt(templateConfig) {
  if (templateConfig?.promptVariant === 'obstetricia') {
    return buildObstetricStructurePrompt();
  }

  return buildDefaultStructurePrompt(templateConfig);
}

module.exports = {
  buildStructurePrompt,
  DEFAULT_STRUCTURE,
};
