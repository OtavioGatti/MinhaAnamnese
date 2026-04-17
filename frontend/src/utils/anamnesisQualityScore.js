const CATEGORY_CONFIG = [
  {
    id: 'history',
    label: 'história clínica',
    teaserLabel: 'história clínica mais detalhada',
    missingJustifications: [
      'Pouca exploração da história clínica.',
      'A evolução do quadro ainda pode ficar mais clara.',
    ],
    patterns: [/\bhist[oó]ria\b/gi, /\bqueixa\b/gi, /\bevolu[cç][aã]o\b/gi],
  },
  {
    id: 'exam',
    label: 'exame físico',
    teaserLabel: 'descrição do exame físico',
    missingJustifications: [
      'A descrição do exame físico ainda pode ser mais detalhada.',
      'Há espaço para tornar o exame físico mais objetivo.',
    ],
    patterns: [/\bexame\b/gi, /\bsinais vitais\b/gi, /\binspe[cç][aã]o\b/gi],
  },
  {
    id: 'historyBackground',
    label: 'antecedentes',
    teaserLabel: 'antecedentes relevantes',
    missingJustifications: [
      'Pouca exploração de antecedentes.',
      'Os antecedentes clínicos ainda podem ser melhor documentados.',
    ],
    patterns: [/\bantecedentes?\b/gi, /\bcomorbidades?\b/gi, /\bhist[oó]ria pregressa\b/gi],
  },
  {
    id: 'medsAllergies',
    label: 'medicações e alergias',
    teaserLabel: 'medicações em uso e alergias',
    missingJustifications: [
      'Ausência de informações sobre medicações em uso ou alergias.',
      'Medicações e alergias ainda podem ser descritas com mais clareza.',
    ],
    patterns: [/\bmedica[cç][aã]o(?:es)?\b/gi, /\balergia(?:s)?\b/gi],
  },
  {
    id: 'plan',
    label: 'conduta e hipótese',
    teaserLabel: 'conduta inicial e hipótese clínica',
    missingJustifications: [
      'Conduta ou hipótese clínica aparecem pouco definidas.',
      'Há espaço para explicitar melhor hipótese clínica ou conduta inicial.',
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
        'Há pouca exploração de desenvolvimento ou histórico vacinal.',
        'Aspectos de desenvolvimento e vacinação ainda podem ser melhor descritos.',
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
        'Faltam referências mais claras a IG, DUM ou USG.',
        'IG, DUM ou USG ainda podem ser melhor explicitados.',
      ],
      exam: [
        'Aspectos obstétricos como BCF ou movimentação fetal podem ser melhor explorados.',
        'Há espaço para detalhar melhor achados obstétricos do exame.',
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
        'A história menstrual ou sexual ainda pode ser melhor explorada.',
        'Há espaço para detalhar melhor aspectos ginecológicos básicos da história.',
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
        'Há espaço para reforçar dados objetivos do exame na avaliação inicial.',
      ],
    },
  },
};

const LOW_SCORE_MESSAGES = [
  'A anamnese sugere espaço importante para maior completude clínica.',
  'O registro ainda pode ganhar mais consistência em pontos essenciais.',
  'Há margem relevante para aprofundar a coleta de informações.',
];

const MEDIUM_SCORE_MESSAGES = [
  'Boa base clínica, com pontos que ainda podem ser melhor explorados.',
  'O registro está adequado, com oportunidades claras de refinamento.',
  'A estrutura é consistente, embora ainda haja pontos a aprofundar.',
];

const HIGH_SCORE_MESSAGES = [
  'Boa base clínica, com pequenos pontos que ainda podem ser refinados.',
  'O registro demonstra boa consistência, com espaço para ajustes pontuais.',
  'Há boa completude clínica, com margem para refinamentos específicos.',
];

const TEASER_MESSAGES = [
  'Alguns pontos podem ser melhor explorados nesta anamnese.',
  'Há elementos importantes que ainda podem ser aprofundados.',
  'A coleta de informações pode ser expandida em pontos relevantes.',
  'A avaliação inicial sugere oportunidades objetivas de refinamento.',
  'Este registro parece consistente, mas ainda pode ganhar mais completude clínica.',
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
    return 'A estrutura ainda pode ficar mais segmentada.';
  }

  return 'Há boa cobertura clínica, com margem para pequenos refinamentos na organização.';
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
      message: 'Ainda não há conteúdo suficiente para estimar a avaliação inicial da anamnese.',
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
  const score = clamp(
    Math.round(30 + sizePoints + structurePoints + categoryPoints + specialtyBonusPoints),
    30,
    90
  );
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
