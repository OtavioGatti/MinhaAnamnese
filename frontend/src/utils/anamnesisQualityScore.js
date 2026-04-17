const CATEGORY_CONFIG = [
  {
    id: 'history',
    label: 'historia clinica',
    teaserLabel: 'historia clinica mais detalhada',
    missingJustifications: [
      'Pouca exploracao da historia clinica.',
      'A evolucao do quadro ainda pode ficar mais clara.',
    ],
    patterns: [/\bhist[oó]ria\b/gi, /\bqueixa\b/gi, /\bevolu[cç][aã]o\b/gi],
  },
  {
    id: 'exam',
    label: 'exame fisico',
    teaserLabel: 'descricao do exame fisico',
    missingJustifications: [
      'A descricao do exame fisico ainda aparece de forma limitada.',
      'Ha espaco para detalhar melhor o exame fisico.',
    ],
    patterns: [/\bexame\b/gi, /\bsinais vitais\b/gi, /\binspe[cç][aã]o\b/gi],
  },
  {
    id: 'historyBackground',
    label: 'antecedentes',
    teaserLabel: 'antecedentes relevantes',
    missingJustifications: [
      'Pouca exploracao de antecedentes.',
      'Os antecedentes clinicos ainda podem ser melhor documentados.',
    ],
    patterns: [/\bantecedentes?\b/gi, /\bcomorbidades?\b/gi, /\bhist[oó]ria pregressa\b/gi],
  },
  {
    id: 'medsAllergies',
    label: 'medicacoes e alergias',
    teaserLabel: 'medicacoes em uso e alergias',
    missingJustifications: [
      'Ausencia de informacoes sobre medicacoes em uso ou alergias.',
      'Medicacoes e alergias ainda podem ser descritas com mais clareza.',
    ],
    patterns: [/\bmedica[cç][aã]o(?:es)?\b/gi, /\balergia(?:s)?\b/gi],
  },
  {
    id: 'plan',
    label: 'conduta e hipotese',
    teaserLabel: 'conduta inicial e hipotese clinica',
    missingJustifications: [
      'Conduta ou hipotese clinica aparecem pouco definidas.',
      'Ha espaco para explicitar melhor hipotese clinica ou conduta inicial.',
    ],
    patterns: [/\bconduta\b/gi, /\bhip[oó]tese\b/gi, /\bimpress[aã]o\b/gi],
  },
];

const SPECIALTY_OVERRIDES = {
  pediatria: {
    categoryBonuses: {
      historyBackground: {
        patterns: [/\bdesenvolvimento\b/gi, /\bneuropsicomotor\b/gi, /\bvacin[aç][aã]o\b/gi],
        bonus: 2,
      },
      medsAllergies: {
        patterns: [/\balimenta[cç][aã]o\b/gi, /\belimina[cç][oõ]es\b/gi],
        bonus: 1,
      },
    },
    missingCategoryMessages: {
      historyBackground: [
        'Ha pouca exploracao de desenvolvimento ou historico vacinal.',
        'Aspectos de desenvolvimento e vacinacao ainda podem ser melhor descritos.',
      ],
    },
  },
  obstetricia: {
    categoryBonuses: {
      history: {
        patterns: [/\bIG\b/gi, /\bDUM\b/gi, /\bUSG\b/gi],
        bonus: 3,
      },
      exam: {
        patterns: [/\bBCF\b/gi, /\bmovimenta[cç][aã]o fetal\b/gi],
        bonus: 2,
      },
    },
    missingCategoryMessages: {
      history: [
        'Faltam referencias mais claras a IG, DUM ou USG.',
        'IG, DUM ou USG ainda podem ser melhor explicitados.',
      ],
      exam: [
        'Aspectos obstetricos como BCF ou movimentacao fetal podem ser melhor explorados.',
        'Ha espaco para detalhar melhor achados obstetricos do exame.',
      ],
    },
  },
  ginecologia: {
    categoryBonuses: {
      history: {
        patterns: [/\bmenstrual\b/gi, /\bsexual\b/gi],
        bonus: 2,
      },
      plan: {
        patterns: [/\bcontracep[cç][aã]o\b/gi, /\bcontraceptivo\b/gi],
        bonus: 1,
      },
    },
    missingCategoryMessages: {
      history: [
        'A historia menstrual ou sexual ainda pode ser melhor explorada.',
        'Ha espaco para detalhar melhor aspectos ginecologicos basicos da historia.',
      ],
    },
  },
  upa_emergencia: {
    categoryBonuses: {
      exam: {
        patterns: [/\bsatur[aç][aã]o\b/gi, /\bpress[aã]o\b/gi, /\bfrequ[eê]ncia\b/gi],
        bonus: 2,
      },
      plan: {
        patterns: [/\bsinal(?:is)? de gravidade\b/gi, /\bgravidade\b/gi],
        bonus: 2,
      },
    },
    missingCategoryMessages: {
      exam: [
        'Sinais vitais ou dados objetivos de exame ainda aparecem pouco definidos.',
        'Ha espaco para reforcar dados objetivos do exame na avaliacao inicial.',
      ],
    },
  },
};

const LOW_SCORE_MESSAGES = [
  'A anamnese sugere espaco importante para maior completude clinica.',
  'O registro ainda pode ganhar mais consistencia em pontos essenciais.',
  'Ha margem relevante para aprofundar a coleta de informacoes.',
];

const MEDIUM_SCORE_MESSAGES = [
  'A anamnese mostra boa base, com aspectos que ainda podem evoluir.',
  'O registro esta adequado, com oportunidades claras de refinamento.',
  'A estrutura e consistente, embora ainda haja pontos a aprofundar.',
];

const HIGH_SCORE_MESSAGES = [
  'A anamnese esta bem organizada, com pequenas oportunidades de melhoria.',
  'O registro demonstra boa consistencia, com espaco para refinamentos pontuais.',
  'Ha boa completude clinica, com margem para ajustes especificos.',
];

const TEASER_MESSAGES = [
  'Alguns pontos podem ser melhor explorados nesta anamnese.',
  'Ha elementos importantes que ainda podem ser aprofundados.',
  'A coleta de informacoes pode ser expandida em pontos relevantes.',
  'A avaliacao inicial sugere oportunidades objetivas de refinamento.',
  'Este registro parece solido, mas ainda pode ganhar mais completude clinica.',
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickVariant(collection, seed) {
  return collection[seed % collection.length];
}

function buildScoreMessage(score, seed) {
  if (score < 55) {
    return pickVariant(LOW_SCORE_MESSAGES, seed);
  }

  if (score < 75) {
    return pickVariant(MEDIUM_SCORE_MESSAGES, seed);
  }

  return pickVariant(HIGH_SCORE_MESSAGES, seed);
}

function buildMissingJustification(missingCategories, seed, structureSegmented) {
  if (missingCategories.length > 0) {
    const primary = missingCategories[0];
    const options = primary.missingJustifications;
    return options[seed % options.length];
  }

  if (!structureSegmented) {
    return 'Estrutura pouco segmentada, apesar da boa cobertura clinica.';
  }

  return 'A cobertura clinica esta boa, com margem para pequenos refinamentos na organizacao.';
}

function buildTeaserMessage(seed, missingCategories) {
  const baseMessage = pickVariant(TEASER_MESSAGES, seed);

  if (missingCategories.length === 0) {
    return baseMessage;
  }

  if (missingCategories.length === 1) {
    return `${baseMessage} Vale revisar ${missingCategories[0].teaserLabel}.`;
  }

  return `${baseMessage} Vale revisar ${missingCategories[0].teaserLabel} e ${missingCategories[1].teaserLabel}.`;
}

function getSpecialtyConfig(templateId) {
  return SPECIALTY_OVERRIDES[templateId] || null;
}

export function evaluateAnamnesisQuality(text, templateId = '') {
  const normalizedText = (text || '').trim();
  const characterCount = normalizedText.length;
  const words = normalizedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const wordCount = words.length;

  if (characterCount < 180 || wordCount < 30) {
    return {
      shouldShowScore: false,
      message: 'Ainda nao ha conteudo suficiente para estimar a avaliacao inicial da anamnese.',
      justification: 'Inclua um registro um pouco mais detalhado para liberar a estimativa.',
      score: null,
      teaser: {
        shouldShowTeaser: false,
        message: '',
      },
    };
  }

  const specialtyConfig = getSpecialtyConfig(templateId);
  const matchedCategories = [];
  const missingCategories = [];
  let specialtyBonusPoints = 0;

  CATEGORY_CONFIG.forEach((category) => {
    const matched = category.patterns.some((pattern) => pattern.test(normalizedText));
    const categoryOverride = specialtyConfig?.categoryBonuses?.[category.id];
    const overrideMatched = categoryOverride
      ? categoryOverride.patterns.some((pattern) => pattern.test(normalizedText))
      : false;

    if (matched || overrideMatched) {
      matchedCategories.push(category);
      if (overrideMatched) {
        specialtyBonusPoints += categoryOverride.bonus;
      }
      return;
    }

    const overrideMessages = specialtyConfig?.missingCategoryMessages?.[category.id];
    missingCategories.push({
      ...category,
      missingJustifications: overrideMessages || category.missingJustifications,
    });
  });

  const paragraphCount = normalizedText
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean).length;
  const hasSectionLabels = /(^|\n)\s*[a-zà-ú]{2,20}\s*:/gim.test(normalizedText);
  const sentenceCount = normalizedText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
  const structureSegmented = paragraphCount >= 2 || hasSectionLabels;

  let sizePoints = 0;
  if (wordCount >= 45) sizePoints += 4;
  if (wordCount >= 90) sizePoints += 4;
  if (characterCount >= 450) sizePoints += 2;
  sizePoints = Math.min(sizePoints, 10);

  let structurePoints = 0;
  if (paragraphCount >= 2) structurePoints += 4;
  if (paragraphCount >= 4) structurePoints += 3;
  if (sentenceCount >= 4) structurePoints += 2;
  if (hasSectionLabels) structurePoints += 3;
  structurePoints = Math.min(structurePoints, 12);

  const categoryPoints = matchedCategories.length * 9;
  const score = clamp(Math.round(30 + sizePoints + structurePoints + categoryPoints + specialtyBonusPoints), 30, 90);
  const seed =
    wordCount +
    characterCount +
    matchedCategories.length +
    paragraphCount +
    sentenceCount +
    specialtyBonusPoints;

  const shouldShowTeaser =
    score < 88 &&
    missingCategories.length > 0 &&
    !(score >= 78 && seed % 3 === 0) &&
    !(score >= 70 && matchedCategories.length >= 4 && seed % 4 === 0);

  return {
    shouldShowScore: true,
    score,
    message: buildScoreMessage(score, seed),
    justification: buildMissingJustification(missingCategories, seed, structureSegmented),
    teaser: {
      shouldShowTeaser,
      message: shouldShowTeaser ? buildTeaserMessage(seed, missingCategories) : '',
    },
  };
}
