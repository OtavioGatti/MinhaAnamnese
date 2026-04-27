export const officialTemplateCatalog = {
  psiquiatria: {
    category: 'Saúde mental',
    description: 'Organiza a anamnese psiquiátrica com foco em narrativa livre, funcionalidade, desenvolvimento, risco, substâncias e exame do estado mental.',
    whenToUse: 'Use em consultas psiquiátricas, primeiras avaliações, reavaliações clínicas e atendimentos em saúde mental que exigem história detalhada.',
    hasCalculators: false,
  },
  pediatria: {
    category: 'Pediatria',
    description: 'Ajuda a estruturar a coleta pediátrica com antecedentes, vacinação e desenvolvimento.',
    whenToUse: 'Use em atendimentos pediátricos gerais, intercorrências agudas e retornos de seguimento.',
    hasCalculators: false,
  },
  clinica_medica: {
    category: 'Clínica médica',
    description: 'Modelo geral para consultas de clínica médica com boa cobertura de antecedentes e revisão de sistemas.',
    whenToUse: 'Use em atendimentos ambulatoriais, enfermaria e consultas generalistas de adultos.',
    hasCalculators: false,
  },
  obstetricia: {
    category: 'Obstetrícia',
    description: 'Estrutura a anamnese obstétrica com dados gestacionais, histórico, sinais de alerta e conduta.',
    whenToUse: 'Use em pré-natal, avaliação obstétrica aguda, triagem e acompanhamento gestacional.',
    hasCalculators: true,
  },
  upa_emergencia: {
    category: 'Urgência e emergência',
    description: 'Modelo direcionado para queixa aguda, sinais de alarme, impressão clínica e conduta imediata.',
    whenToUse: 'Use em UPA, pronto atendimento e cenários com necessidade de avaliação rápida e dirigida.',
    hasCalculators: false,
  },
  puerperio: {
    category: 'Puerpério',
    description: 'Organiza a avaliação pós-parto com foco em evolução, amamentação, loquiação e sinais infecciosos.',
    whenToUse: 'Use em consultas de puerpério, retornos precoces e avaliação de intercorrências pós-parto.',
    hasCalculators: false,
  },
  ginecologia: {
    category: 'Ginecologia',
    description: 'Estrutura o atendimento ginecológico com história menstrual, sexual, antecedentes e exame físico.',
    whenToUse: 'Use em consultas ginecológicas ambulatoriais, queixas agudas e seguimento clínico.',
    hasCalculators: false,
  },
  triagem: {
    category: 'Triagem',
    description: 'Modelo objetivo para classificar risco, registrar sinais vitais e orientar a primeira impressão clínica.',
    whenToUse: 'Use em acolhimento, classificação de risco e fluxos iniciais de atendimento.',
    hasCalculators: false,
  },
};

export const templateCategories = [
  'Todos',
  'Clínica médica',
  'Ginecologia',
  'Obstetrícia',
  'Pediatria',
  'Puerpério',
  'Saúde mental',
  'Triagem',
  'Urgência e emergência',
];
