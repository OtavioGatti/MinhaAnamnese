const BASE_CLINICAL_SECTIONS = [
  'Identificação',
  'Hipóteses diagnósticas / problemas ativos',
  'Queixa principal',
  'História da moléstia atual (HDA)',
  'Medicações em uso contínuo',
  'História pregressa',
  'Doenças de base',
  'História familiar',
  'Hábitos de vida',
  'Interrogatório sintomatológico',
  'Exames complementares',
  'Exame físico',
];

const templates = {
  psiquiatria: {
    nome: 'Psiquiatria',
    secoes: [
      'Identificação',
      'Queixa principal',
      'História da moléstia atual',
      'História psiquiátrica pregressa',
      'História familiar',
      'Medicações em uso',
      'Uso de substâncias',
      'Exame do estado mental',
      'Hipóteses diagnósticas / problemas ativos',
      'Conduta',
    ],
  },

  pediatria: {
    nome: 'Pediatria',
    secoes: [
      'Identificação',
      'Queixa principal',
      'História da moléstia atual',
      'Antecedentes pessoais',
      'Antecedentes familiares',
      'Vacinação',
      'Desenvolvimento neuropsicomotor',
      'Medicações em uso',
      'Exames complementares',
      'Exame físico',
      'Hipóteses diagnósticas / problemas ativos',
      'Conduta',
    ],
  },

  clinica_medica: {
    nome: 'Clínica médica / Ambulatório',
    secoes: BASE_CLINICAL_SECTIONS,
  },

  obstetricia: {
    nome: 'Obstetrícia',
    secoes: [
      'ID',
      'IG (USG) | (DUM)',
      'Tipagem sanguínea',
      'QPD',
      'H. obstétrico',
      'HV',
      'Alergia',
      'Doenças de base',
      'MUC',
      'Ex. físico',
      'HD',
      'Conduta',
    ],
    promptVariant: 'obstetricia',
  },

  upa_emergencia: {
    nome: 'UPA / Emergência',
    secoes: [
      'Identificação',
      'Queixa principal',
      'História da moléstia atual (foco na queixa)',
      'Tempo de evolução',
      'Sintomas associados',
      'Sinais de alarme',
      'Comorbidades / doenças de base',
      'Medicações em uso',
      'Exames complementares',
      'Exame físico direcionado',
      'Impressão clínica inicial',
      'Conduta',
    ],
  },

  puerperio: {
    nome: 'Puerpério',
    secoes: [
      'Identificação',
      'Tipo de parto',
      'Tempo de pós-parto',
      'Queixa principal',
      'Evolução pós-parto',
      'Amamentação',
      'Loquiação',
      'Dor / sinais infecciosos',
      'Eliminações fisiológicas',
      'Estado emocional',
      'Medicações em uso',
      'Exame físico',
      'Conduta',
    ],
  },

  ginecologia: {
    nome: 'Ginecologia',
    secoes: [
      'Identificação',
      'Queixa principal',
      'História da moléstia atual',
      'História menstrual (DUM, ciclo)',
      'Vida sexual',
      'Método contraceptivo',
      'Corrimento / dor pélvica',
      'Antecedentes ginecológicos',
      'Medicações em uso',
      'Exames complementares',
      'Exame físico',
      'Hipóteses diagnósticas / problemas ativos',
      'Conduta',
    ],
  },

  triagem: {
    nome: 'Triagem rápida',
    secoes: [
      'Identificação',
      'Queixa principal',
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
