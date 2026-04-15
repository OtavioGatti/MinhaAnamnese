/**
 * Centralização de todos os templates médicos do sistema
 * Estrutura padronizada para fácil expansão
 */

const templates = {
  psiquiatria: {
    nome: 'Psiquiatria',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'História Psiquiátrica Pregressa',
      'História Familiar',
      'Uso de Medicações',
      'Uso de Substâncias',
      'Exame do Estado Mental',
      'Hipótese Diagnóstica',
      'Conduta',
    ],
  },

  pediatria: {
    nome: 'Pediatria',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'Antecedentes Pessoais',
      'Antecedentes Familiares',
      'Vacinação',
      'Desenvolvimento Neuropsicomotor',
      'Exame Físico',
      'Hipótese Diagnóstica',
      'Conduta',
    ],
  },

  clinica_medica: {
    nome: 'Clínica Médica',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'Revisão de Sistemas',
      'Antecedentes',
      'Medicações em Uso',
      'Exame Físico',
      'Hipótese Diagnóstica',
      'Plano',
    ],
  },

  obstetricia: {
    nome: 'Obstetrícia',
    secoes: [
      'ID',
      'IG (USG) | (DUM)',
      'Tipagem Sanguínea',
      'QPD',
      'H. Obstétrico',
      'HV',
      'Alergia',
      'Doenças de Base',
      'MUC',
      'Ex. Físico',
      'HD',
      'Conduta',
    ],
    promptSistema: `Você é um médico responsável por organizar registros clínicos obstétricos de forma técnica, objetiva e fiel às informações fornecidas.

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
- Se um campo não tem informação, escreva "Não informado" — NUNCA omita ou esconda a seção
- Manter siglas médicas apropriadas (IG, DUM, BCF, etc.)
- Não adicionar seções extras
- Não remover seções do modelo
- Escrever sempre em parágrafo dentro dos itens e não em tópicos (Ex: ID: Nome, 32 anos, Casada...)`,
  },

  upa_emergencia: {
    nome: 'UPA / Emergência',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual (foco na queixa)',
      'Tempo de evolução',
      'Sintomas associados',
      'Sinais de alarme',
      'Comorbidades',
      'Medicações em uso',
      'Exame Físico direcionado',
      'Impressão clínica',
      'Conduta',
    ],
  },

  puerperio: {
    nome: 'Puerpério',
    secoes: [
      'Identificação',
      'Tipo de parto',
      'Tempo de pós-parto',
      'Queixa Principal',
      'Evolução pós-parto',
      'Amamentação',
      'Loquiação',
      'Dor / sinais infecciosos',
      'Eliminações fisiológicas',
      'Estado emocional',
      'Exame Físico',
      'Conduta',
    ],
  },

  ginecologia: {
    nome: 'Ginecologia',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'História da Doença Atual',
      'História menstrual (DUM, ciclo)',
      'Vida sexual',
      'Método contraceptivo',
      'Corrimento / dor pélvica',
      'Antecedentes ginecológicos',
      'Exame Físico',
      'Hipótese Diagnóstica',
      'Conduta',
    ],
  },

  triagem: {
    nome: 'Triagem Rápida',
    secoes: [
      'Identificação',
      'Queixa Principal',
      'Tempo de início',
      'Sintomas associados',
      'Sinais de gravidade',
      'Comorbidades',
      'Medicações em uso',
      'Sinais vitais',
      'Impressão inicial',
    ],
  },
};

module.exports = templates;
