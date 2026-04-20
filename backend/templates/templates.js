const templates = {
  psiquiatria: {
    nome: 'Psiquiatria',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Historia da Doenca Atual',
      'Historia Psiquiatrica Pregressa',
      'Historia Familiar',
      'Uso de Medicacoes',
      'Uso de Substancias',
      'Exame do Estado Mental',
      'Hipotese Diagnostica',
      'Conduta',
    ],
  },

  pediatria: {
    nome: 'Pediatria',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Historia da Doenca Atual',
      'Antecedentes Pessoais',
      'Antecedentes Familiares',
      'Vacinacao',
      'Desenvolvimento Neuropsicomotor',
      'Exame Fisico',
      'Hipotese Diagnostica',
      'Conduta',
    ],
  },

  clinica_medica: {
    nome: 'Clinica Medica',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Historia da Doenca Atual',
      'Revisao de Sistemas',
      'Antecedentes',
      'Medicacoes em Uso',
      'Exame Fisico',
      'Hipotese Diagnostica',
      'Plano',
    ],
  },

  obstetricia: {
    nome: 'Obstetricia',
    secoes: [
      'ID',
      'IG (USG) | (DUM)',
      'Tipagem Sanguinea',
      'QPD',
      'H. Obstetrico',
      'HV',
      'Alergia',
      'Doencas de Base',
      'MUC',
      'Ex. Fisico',
      'HD',
      'Conduta',
    ],
    promptVariant: 'obstetricia',
  },

  upa_emergencia: {
    nome: 'UPA / Emergencia',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Historia da Doenca Atual (foco na queixa)',
      'Tempo de evolucao',
      'Sintomas associados',
      'Sinais de alarme',
      'Comorbidades',
      'Medicacoes em uso',
      'Exame Fisico direcionado',
      'Impressao clinica',
      'Conduta',
    ],
  },

  puerperio: {
    nome: 'Puerperio',
    secoes: [
      'Identificacao',
      'Tipo de parto',
      'Tempo de pos-parto',
      'Queixa Principal',
      'Evolucao pos-parto',
      'Amamentacao',
      'Loquiacao',
      'Dor / sinais infecciosos',
      'Eliminacoes fisiologicas',
      'Estado emocional',
      'Exame Fisico',
      'Conduta',
    ],
  },

  ginecologia: {
    nome: 'Ginecologia',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Historia da Doenca Atual',
      'Historia menstrual (DUM, ciclo)',
      'Vida sexual',
      'Metodo contraceptivo',
      'Corrimento / dor pelvica',
      'Antecedentes ginecologicos',
      'Exame Fisico',
      'Hipotese Diagnostica',
      'Conduta',
    ],
  },

  triagem: {
    nome: 'Triagem Rapida',
    secoes: [
      'Identificacao',
      'Queixa Principal',
      'Tempo de inicio',
      'Sintomas associados',
      'Sinais de gravidade',
      'Comorbidades',
      'Medicacoes em uso',
      'Sinais vitais',
      'Impressao inicial',
    ],
  },
};

module.exports = templates;
