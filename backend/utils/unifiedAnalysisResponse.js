const { sanitizeText } = require('./textSanitization');

const ALLOWED_SECTION_STATUSES = new Set(['present', 'partial', 'missing', 'not_applicable']);
const EMERGENCY_RISK_PATTERNS = [
  /dor\s+tor[aá]cica/i,
  /precordialgia/i,
  /dispneia/i,
  /s[ií]ncope/i,
  /sangramento/i,
  /hemorragia/i,
  /rebaixamento/i,
  /d[eé]ficit\s+neurol[oó]gico/i,
  /instabilidade/i,
  /sudorese/i,
  /dor\s+opressiva/i,
];
const OBJECTIVE_EXAM_PATTERNS = [
  /\bpa\b/i,
  /press[aã]o\s+arterial/i,
  /\bfc\b/i,
  /frequ[eê]ncia\s+card[ií]aca/i,
  /\bfr\b/i,
  /frequ[eê]ncia\s+respirat[oó]ria/i,
  /temperatura/i,
  /satura[cç][aã]o/i,
  /\bspo2\b/i,
  /exame\s+f[ií]sico/i,
  /ao\s+exame/i,
];

function normalizeText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const ACUTE_CONTEXT_PATTERNS = [
  ...EMERGENCY_RISK_PATTERNS,
  /dor\s+abdominal/i,
  /inicio\s+agudo/i,
  /hipocondrio/i,
  /murphy/i,
  /defesa\s+muscular/i,
  /irritacao\s+peritoneal/i,
  /nauseas?/i,
  /vomitos?/i,
];
const LOW_PRIORITY_ACUTE_PATTERNS = [
  /historia\s+familiar/i,
  /habitos?\s+de\s+vida/i,
  /dados\s+sociais/i,
  /tabagismo/i,
  /etilismo/i,
  /sedentar/i,
];
const HIGH_PRIORITY_INSIGHT_PATTERNS = [
  /medicacoes?/i,
  /medicamentos?/i,
  /remedios?/i,
  /alergias?/i,
  /exame\s+fisico/i,
  /sinais\s+vitais/i,
  /interrogatorio/i,
  /sintomas?\s+associados?/i,
  /sinais?\s+de\s+alarme/i,
  /gravidade/i,
  /\bhma\b/i,
  /\bhda\b/i,
  /historia\s+da\s+molestia/i,
  /tempo\s+de\s+evolucao/i,
  /evolucao/i,
  /queixa\s+principal/i,
];
const ACUTE_PRIORITY_SECTION_GROUPS = [
  {
    key: 'objectiveExam',
    priority: 0,
    patterns: [
      /exame\s+fisico/i,
      /sinais\s+vitais/i,
      /\bpa\b/i,
      /\bfc\b/i,
      /\bfr\b/i,
      /saturacao/i,
      /temperatura/i,
    ],
  },
  {
    key: 'medications',
    priority: 1,
    patterns: [
      /medicacoes?/i,
      /medicamentos?/i,
      /remedios?/i,
      /uso\s+continuo/i,
      /alergias?/i,
    ],
  },
  {
    key: 'symptoms',
    priority: 2,
    patterns: [
      /interrogatorio/i,
      /sintomatologico/i,
      /sintomas?\s+associados?/i,
      /sinais?\s+de\s+alarme/i,
      /gravidade/i,
      /revisao\s+de\s+sistemas/i,
    ],
  },
  {
    key: 'clinicalHistory',
    priority: 3,
    patterns: [
      /\bhma\b/i,
      /\bhda\b/i,
      /historia\s+da\s+molestia/i,
      /historia\s+da\s+doenca/i,
      /tempo\s+de\s+evolucao/i,
      /evolucao/i,
      /queixa\s+principal/i,
    ],
  },
  {
    key: 'antecedents',
    priority: 4,
    patterns: [
      /antecedentes/i,
      /comorbidades/i,
      /doencas?\s+de\s+base/i,
      /historia\s+pregressa/i,
    ],
  },
  {
    key: 'exams',
    priority: 5,
    patterns: [
      /exames?\s+complementares/i,
      /laboratorio/i,
      /imagem/i,
      /ultrassom/i,
      /\busg\b/i,
    ],
  },
  {
    key: 'lowPriority',
    priority: 9,
    patterns: LOW_PRIORITY_ACUTE_PATTERNS,
  },
];
const SECTION_EVIDENCE_RULES = [
  {
    key: 'exams',
    targetStatus: 'present',
    sectionPatterns: [
      /exames?\s+complementares/i,
      /exames?/i,
      /laboratorio/i,
      /imagem/i,
    ],
    evidencePatterns: [
      /hemograma/i,
      /proteina\s+c\s+reativa/i,
      /\bpcr\b/i,
      /funcao\s+renal/i,
      /eletrolitos/i,
      /gasometria/i,
      /radiografia/i,
      /raio\s*x/i,
      /\brx\b/i,
      /tomografia/i,
      /ressonancia/i,
      /ultrassom/i,
      /ultrassonografia/i,
      /\busg\b/i,
      /\becg\b/i,
      /bilirrubinas?/i,
      /provas?\s+de\s+funcao\s+hepatica/i,
      /solicitad[oa]s?/i,
    ],
  },
  {
    key: 'familyHistory',
    targetStatus: 'present',
    sectionPatterns: [
      /historia\s+familiar/i,
      /\bhf\b/i,
    ],
    evidencePatterns: [
      /historia\s+familiar/i,
      /\bpai\b/i,
      /\bmae\b/i,
      /irmaos?/i,
      /familiares?/i,
      /infarto/i,
      /diabetes/i,
      /hipertens/i,
      /tromboembolismo/i,
      /neoplasia/i,
      /sem\s+historia\s+familiar/i,
      /nega\s+historia\s+familiar/i,
    ],
  },
  {
    key: 'habits',
    targetStatus: 'present',
    sectionPatterns: [
      /habitos?/i,
      /vida/i,
      /tabagismo/i,
      /etilismo/i,
    ],
    evidencePatterns: [
      /tabagista/i,
      /ex-tabagista/i,
      /anos-maco/i,
      /anos\s+maco/i,
      /etilismo/i,
      /alcool/i,
      /drogas?\s+ilicitas?/i,
      /sedentario/i,
      /atividade\s+fisica/i,
      /cessou/i,
      /nega\s+etilismo/i,
      /nega\s+uso\s+de\s+drogas/i,
    ],
  },
  {
    key: 'medications',
    targetStatus: 'partial',
    upgradePartial: false,
    sectionPatterns: [
      /medicacoes?/i,
      /medicamentos?/i,
      /uso\s+continuo/i,
      /remedios?/i,
    ],
    evidencePatterns: [
      /medicacoes?\s+em\s+uso/i,
      /uso\s+continuo/i,
      /losartana/i,
      /sinvastatina/i,
      /formoterol/i,
      /budesonida/i,
      /salbutamol/i,
      /inaladores?/i,
      /antibioticos?/i,
      /corticoide/i,
      /nega\s+uso\s+recente/i,
      /nega\s+medicacoes/i,
      /sem\s+medicacoes/i,
      /alergias?\s+medicamentosas?/i,
      /nega\s+alergias?/i,
    ],
  },
  {
    key: 'physicalExam',
    targetStatus: 'present',
    sectionPatterns: [
      /exame\s+fisico/i,
      /sinais\s+vitais/i,
    ],
    evidencePatterns: [
      /ao\s+exame/i,
      /exame\s+fisico/i,
      /\bpa\b/i,
      /\bfc\b/i,
      /\bfr\b/i,
      /spo2/i,
      /saturacao/i,
      /ausculta/i,
      /abdome/i,
      /murphy/i,
      /crepitacoes/i,
      /murmurio/i,
      /taquipneic/i,
    ],
  },
];

function normalizeScore(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeArray(value, maxItems = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const items = [];

  for (const item of value) {
    const text = normalizeText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(text);

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

function extractJsonObject(rawText) {
  const text = sanitizeText(String(rawText || '')).trim();

  if (!text) {
    throw new Error('empty_unified_analysis_response');
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start < 0 || end <= start) {
      throw new Error('invalid_unified_analysis_json');
    }

    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeConfidence(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized === 'alta' || normalized === 'high') {
    return 'alta';
  }

  if (normalized === 'media' || normalized === 'medium') {
    return 'media';
  }

  if (normalized === 'baixa' || normalized === 'low') {
    return 'baixa';
  }

  return 'baixa';
}

function normalizeSectionStatus(value) {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized === 'presente' || normalized === 'complete') {
    return 'present';
  }

  if (normalized === 'parcial' || normalized === 'incomplete') {
    return 'partial';
  }

  if (normalized === 'ausente' || normalized === 'not_reported') {
    return 'missing';
  }

  if (normalized === 'nao_aplicavel' || normalized === 'not_applicable') {
    return 'not_applicable';
  }

  return ALLOWED_SECTION_STATUSES.has(normalized) ? normalized : 'partial';
}

function buildCriticalInsightFromObject(priorityInsight) {
  if (!priorityInsight || typeof priorityInsight !== 'object') {
    return '';
  }

  const failure = normalizeText(priorityInsight.failure || priorityInsight.falha);
  const readingImpact = normalizeText(
    priorityInsight.readingImpact ||
    priorityInsight.reading_impact ||
    priorityInsight.consequence ||
    priorityInsight.consequencia,
  );
  const qualityImpact = normalizeText(
    priorityInsight.qualityImpact ||
    priorityInsight.quality_impact ||
    priorityInsight.impact ||
    priorityInsight.impacto,
  );
  const action = normalizeText(priorityInsight.action || priorityInsight.acao || priorityInsight.recommendation);

  if (!failure && !readingImpact && !qualityImpact && !action) {
    return '';
  }

  return [
    `FALHA -> ${failure || 'Lacuna estrutural prioritária'}`,
    `CONSEQUENCIA NA LEITURA -> ${readingImpact || 'Reduz a clareza da leitura do caso'}`,
    `IMPACTO NA QUALIDADE -> ${qualityImpact || 'Diminui a consistência documental da anamnese'}`,
    `ACAO DIRETA -> ${action || 'Complete esse ponto na próxima coleta'}`,
  ].join(' -> ');
}

function normalizeSections(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 40).map((section, index) => {
    const maxScore = normalizeScore(section?.maxScore ?? section?.max_score ?? section?.weight);
    const score = normalizeScore(section?.score);

    return {
      id: normalizeText(section?.id) || `section_${index + 1}`,
      label: normalizeText(section?.label || section?.name || section?.title) || `Seção ${index + 1}`,
      status: normalizeSectionStatus(section?.status),
      score: score === null ? null : score,
      maxScore: maxScore === null ? null : maxScore,
      evidence: normalizeText(section?.evidence),
      issue: normalizeText(section?.issue || section?.gap),
      recommendation: normalizeText(section?.recommendation || section?.action),
    };
  });
}

function getStatusScore(status, maxScore) {
  if (typeof maxScore !== 'number' || maxScore <= 0) {
    return null;
  }

  if (status === 'present') {
    return maxScore;
  }

  if (status === 'partial') {
    return Math.max(1, Math.round(maxScore * 0.65));
  }

  if (status === 'missing') {
    return 0;
  }

  return null;
}

function applySectionEvidenceGuards(sections, contextText) {
  if (!Array.isArray(sections) || !sections.length) {
    return {
      sections,
      adjustments: [],
    };
  }

  const adjustments = [];
  const nextSections = sections.map((section) => {
    if (!sectionNeedsAttention(section)) {
      return section;
    }

    for (const rule of SECTION_EVIDENCE_RULES) {
      if (!sectionLooksLike(section, rule.sectionPatterns)) {
        continue;
      }

      if (!textMatchesAny(contextText, rule.evidencePatterns)) {
        continue;
      }

      if (section.status === 'partial' && rule.upgradePartial === false) {
        return section;
      }

      const nextStatus = rule.targetStatus || 'partial';
      const nextScore = getStatusScore(nextStatus, section.maxScore);

      adjustments.push({
        sectionId: section.id,
        sectionLabel: section.label,
        fromStatus: section.status,
        toStatus: nextStatus,
        reason: `evidence_detected:${rule.key}`,
      });

      return {
        ...section,
        status: nextStatus,
        score: nextScore === null ? section.score : nextScore,
        evidence: section.evidence || 'Evidência identificada no texto original ou estruturado.',
        issue: '',
        recommendation: '',
      };
    }

    return section;
  });

  return {
    sections: nextSections,
    adjustments,
  };
}

function getScoreLabel(score) {
  if (score <= 30) {
    return 'Estrutura crítica';
  }

  if (score <= 50) {
    return 'Estrutura insuficiente';
  }

  if (score <= 70) {
    return 'Estrutura parcial';
  }

  if (score <= 85) {
    return 'Boa estrutura com lacunas relevantes';
  }

  return 'Estrutura consistente';
}

function getSectionStatusCounts(sections) {
  return sections.reduce((counts, section) => {
    const status = section.status || 'partial';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {
    present: 0,
    partial: 0,
    missing: 0,
    not_applicable: 0,
  });
}

function sectionLooksLike(section, patterns) {
  const haystack = normalizeForSearch([
    section?.id,
    section?.label,
    section?.issue,
    section?.recommendation,
  ].filter(Boolean).join(' '));

  return patterns.some((pattern) => pattern.test(haystack));
}

function textMatchesAny(value, patterns) {
  const normalized = normalizeForSearch(value);

  return patterns.some((pattern) => pattern.test(normalized));
}

function detectAcuteContext(contextText) {
  return textMatchesAny(contextText, ACUTE_CONTEXT_PATTERNS);
}

function sectionNeedsAttention(section) {
  return section?.status === 'missing' || section?.status === 'partial';
}

function findPrioritySection(sections) {
  for (const group of ACUTE_PRIORITY_SECTION_GROUPS) {
    if (group.key === 'lowPriority') {
      continue;
    }

    const section = sections.find((item) => sectionNeedsAttention(item) && sectionLooksLike(item, group.patterns));

    if (section) {
      return {
        ...group,
        section,
      };
    }
  }

  return null;
}

function findTextPriorityGroup(value) {
  for (const group of ACUTE_PRIORITY_SECTION_GROUPS) {
    if (textMatchesAny(value, group.patterns)) {
      return group;
    }
  }

  return null;
}

function buildAcuteCriticalInsight(candidate) {
  if (!candidate?.section) {
    return '';
  }

  const isMissing = candidate.section.status === 'missing';

  if (candidate.key === 'objectiveExam') {
    return [
      `FALHA -> ${isMissing ? 'Exame físico e sinais vitais não documentados' : 'Exame físico ou sinais vitais pouco detalhados'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Limita a leitura objetiva de gravidade, estabilidade clínica e evolução do quadro',
      'IMPACTO NA QUALIDADE -> Reduz a segurança documental e a utilidade da anamnese para revisão clínica',
      'ACAO DIRETA -> Registre sinais vitais e achados objetivos relevantes na próxima coleta',
    ].join(' -> ');
  }

  if (candidate.key === 'medications') {
    return [
      `FALHA -> ${isMissing ? 'Medicações em uso e alergias não documentadas' : 'Medicações em uso ou alergias pouco detalhadas'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Limita a avaliação de segurança medicamentosa, exposições recentes, alergias e riscos na continuidade do cuidado',
      'IMPACTO NA QUALIDADE -> Reduz a completude documental de segurança do registro',
      'ACAO DIRETA -> Registre medicações em uso, alergias e uso recente de medicamentos na próxima coleta',
    ].join(' -> ');
  }

  if (candidate.key === 'symptoms') {
    return [
      `FALHA -> ${isMissing ? 'Interrogatório sintomatológico não documentado' : 'Interrogatório sintomatológico pouco detalhado'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Dificulta identificar sintomas associados, sinais de alarme e elementos de gravidade',
      'IMPACTO NA QUALIDADE -> Reduz a capacidade de acompanhar progressão e risco clínico do quadro',
      'ACAO DIRETA -> Inclua revisão dirigida de sintomas associados e sinais de alarme na próxima coleta',
    ].join(' -> ');
  }

  if (candidate.key === 'clinicalHistory') {
    return [
      `FALHA -> ${isMissing ? 'História da queixa atual não documentada' : 'História da queixa atual pouco detalhada'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Prejudica a leitura de início, evolução, irradiação, fatores associados e resposta inicial',
      'IMPACTO NA QUALIDADE -> Reduz a coerência temporal e a capacidade de revisão clínica do caso',
      'ACAO DIRETA -> Detalhe início, evolução, intensidade, irradiação, fatores de melhora ou piora e sintomas associados',
    ].join(' -> ');
  }

  if (candidate.key === 'antecedents') {
    return [
      `FALHA -> ${isMissing ? 'Antecedentes e comorbidades não documentados' : 'Antecedentes e comorbidades pouco detalhados'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Dificulta reconhecer fatores de risco e condições que mudam a interpretação do quadro',
      'IMPACTO NA QUALIDADE -> Reduz a contextualização clínica e a segurança da revisão',
      'ACAO DIRETA -> Registre comorbidades, antecedentes relevantes, cirurgias, internações e alergias quando aplicável',
    ].join(' -> ');
  }

  if (candidate.key === 'exams') {
    return [
      `FALHA -> ${isMissing ? 'Exames complementares não documentados' : 'Exames complementares pouco detalhados'} em contexto agudo`,
      'CONSEQUENCIA NA LEITURA -> Limita o suporte documental para acompanhar hipóteses, gravidade e evolução',
      'IMPACTO NA QUALIDADE -> Reduz a rastreabilidade da avaliação clínica',
      'ACAO DIRETA -> Registre exames solicitados ou disponíveis, com achados relevantes e pendências',
    ].join(' -> ');
  }

  return '';
}

function buildAcuteJustification(candidate, fallbackJustification) {
  if (!candidate?.section) {
    return fallbackJustification;
  }

  if (candidate.key === 'medications') {
    return 'A anamnese traz dados relevantes da queixa atual, mas em contexto agudo a principal lacuna estrutural é a ausência de medicações em uso, alergias e uso recente de medicamentos, pois isso afeta a segurança da leitura clínica e da continuidade do cuidado. Lacunas como história familiar ou hábitos de vida podem ser completadas depois, mas têm menor prioridade documental neste cenário.';
  }

  if (candidate.key === 'symptoms') {
    return 'A anamnese apresenta elementos centrais do quadro, mas em contexto agudo a ausência de interrogatório sintomatológico dirigido limita a avaliação de sintomas associados, sinais de alarme e gravidade. Lacunas de menor impacto, como história familiar ou hábitos de vida, não devem ser tratadas como o principal enfraquecedor quando há pendências de segurança clínica.';
  }

  if (candidate.key === 'objectiveExam') {
    return 'A anamnese descreve a história clínica, mas em contexto agudo a principal limitação é a falta de exame físico objetivo ou sinais vitais suficientes. Esses dados são prioritários para estimar gravidade, estabilidade e evolução do quadro.';
  }

  if (candidate.key === 'clinicalHistory') {
    return 'A anamnese tem estrutura parcial, mas a principal lacuna em contexto agudo está na história da queixa atual, que precisa sustentar início, evolução, intensidade, irradiação, fatores associados e resposta inicial.';
  }

  if (candidate.key === 'antecedents') {
    return 'A anamnese possui dados úteis da queixa atual, mas os antecedentes e comorbidades ainda limitam a contextualização clínica e a segurança da revisão em contexto agudo.';
  }

  if (candidate.key === 'exams') {
    return 'A anamnese possui dados clínicos relevantes, mas a documentação de exames complementares limita o suporte objetivo para acompanhar hipóteses, gravidade e evolução do quadro.';
  }

  return fallbackJustification;
}

function prioritizeCriticalInsight({ criticalInsight, justification, sections, contextText }) {
  if (!detectAcuteContext(contextText)) {
    return {
      criticalInsight,
      justification,
      adjusted: false,
    };
  }

  const candidate = findPrioritySection(sections);

  if (!candidate) {
    return {
      criticalInsight,
      justification,
      adjusted: false,
    };
  }

  const insightHasLowPriority = textMatchesAny(criticalInsight, LOW_PRIORITY_ACUTE_PATTERNS);
  const insightHasHighPriority = textMatchesAny(criticalInsight, HIGH_PRIORITY_INSIGHT_PATTERNS);

  if (!insightHasLowPriority && insightHasHighPriority) {
    return {
      criticalInsight,
      justification,
      adjusted: false,
    };
  }

  const replacement = buildAcuteCriticalInsight(candidate);

  if (!replacement) {
    return {
      criticalInsight,
      justification,
      adjusted: false,
    };
  }

  return {
    criticalInsight: replacement,
    justification: buildAcuteJustification(candidate, justification),
    adjusted: true,
  };
}

function insightMatchesEvidenceAdjustment(insightText, sectionEvidenceAdjustments) {
  if (!sectionEvidenceAdjustments.length) {
    return false;
  }

  const resolvedKeys = new Set(
    sectionEvidenceAdjustments
      .map((adjustment) => String(adjustment.reason || '').replace(/^evidence_detected:/, ''))
      .filter(Boolean),
  );

  for (const rule of SECTION_EVIDENCE_RULES) {
    if (!resolvedKeys.has(rule.key)) {
      continue;
    }

    if (textMatchesAny(insightText, rule.sectionPatterns)) {
      return true;
    }
  }

  return false;
}

function buildResolvedInsightFallback({ sections, contextText, fallbackJustification }) {
  const candidate = detectAcuteContext(contextText) ? findPrioritySection(sections) : null;

  if (candidate) {
    return {
      criticalInsight: buildAcuteCriticalInsight(candidate),
      justification: buildAcuteJustification(candidate, fallbackJustification),
      adjusted: true,
    };
  }

  return {
    criticalInsight: 'FALHA -> Nenhuma lacuna estrutural dominante identificada -> CONSEQUENCIA NA LEITURA -> A documentação atual sustenta boa leitura clínica do caso -> IMPACTO NA QUALIDADE -> Mantém a rastreabilidade e a consistência da anamnese -> ACAO DIRETA -> Preserve esse padrão e refine apenas detalhes contextuais quando necessário',
    justification: 'A anamnese apresenta os blocos essenciais bem documentados. As lacunas inicialmente apontadas foram reavaliadas contra o texto original e não se sustentaram como ausências estruturais prioritárias.',
    adjusted: true,
  };
}

function prioritizeOtherGaps(otherGaps, criticalInsight, contextText) {
  if (!detectAcuteContext(contextText)) {
    return otherGaps;
  }

  const criticalGroup = findTextPriorityGroup(criticalInsight);

  return [...otherGaps]
    .filter((gap) => {
      const gapGroup = findTextPriorityGroup(gap);

      return !criticalGroup || !gapGroup || gapGroup.key !== criticalGroup.key;
    })
    .sort((a, b) => {
      const aGroup = findTextPriorityGroup(a);
      const bGroup = findTextPriorityGroup(b);
      const aPriority = aGroup?.priority ?? 6;
      const bPriority = bGroup?.priority ?? 6;

      return aPriority - bPriority;
    });
}

function removeResolvedOtherGaps(otherGaps, sectionEvidenceAdjustments) {
  if (!sectionEvidenceAdjustments.length) {
    return otherGaps;
  }

  const resolvedKeys = new Set(
    sectionEvidenceAdjustments
      .map((adjustment) => String(adjustment.reason || '').replace(/^evidence_detected:/, ''))
      .filter(Boolean),
  );

  if (!resolvedKeys.size) {
    return otherGaps;
  }

  return otherGaps.filter((gap) => {
    for (const rule of SECTION_EVIDENCE_RULES) {
      if (!resolvedKeys.has(rule.key)) {
        continue;
      }

      if (textMatchesAny(gap, rule.sectionPatterns)) {
        return false;
      }
    }

    return true;
  });
}

function findObjectiveExamSection(sections) {
  return sections.find((section) => sectionLooksLike(section, [
    /exame\s+fisico/i,
    /sinais\s+vitais/i,
    /\bpa\b/i,
    /\bfc\b/i,
    /\bfr\b/i,
    /saturacao/i,
  ])) || null;
}

function calculateSectionBasedScore(sections) {
  const scorableSections = sections.filter((section) => (
    section.status !== 'not_applicable' &&
    typeof section.score === 'number' &&
    typeof section.maxScore === 'number' &&
    section.maxScore > 0
  ));

  if (!scorableSections.length) {
    return null;
  }

  const earned = scorableSections.reduce((sum, section) => sum + Math.max(0, section.score), 0);
  const possible = scorableSections.reduce((sum, section) => sum + Math.max(0, section.maxScore), 0);

  if (!possible) {
    return null;
  }

  return normalizeScore((earned / possible) * 100);
}

function detectEmergencyRisk(contextText) {
  const normalized = normalizeForSearch(contextText);

  return EMERGENCY_RISK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function detectObjectiveExamEvidence(contextText) {
  const normalized = normalizeForSearch(contextText);

  return OBJECTIVE_EXAM_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getScoreCap({ sections, contextText }) {
  const counts = getSectionStatusCounts(sections);
  const hasEmergencyRisk = detectEmergencyRisk(contextText);
  const hasObjectiveExamEvidence = detectObjectiveExamEvidence(contextText);
  const objectiveExamSection = findObjectiveExamSection(sections);
  const objectiveExamMissing = objectiveExamSection?.status === 'missing' || (
    hasEmergencyRisk &&
    !hasObjectiveExamEvidence &&
    !objectiveExamSection
  );
  const caps = [];

  if (hasEmergencyRisk && objectiveExamMissing) {
    caps.push(68);
  }

  if (counts.missing >= 2) {
    caps.push(70);
  }

  if (counts.missing >= 1 && counts.partial >= 1) {
    caps.push(78);
  }

  return caps.length ? Math.min(...caps) : null;
}

function recalibrateScore({ score, sections, contextText, allowEvidenceScoreBoost = false }) {
  const sectionScore = calculateSectionBasedScore(sections);
  const scoreCap = getScoreCap({ sections, contextText });
  const baseScore = allowEvidenceScoreBoost && sectionScore !== null && sectionScore > score
    ? Math.min(sectionScore, 96)
    : score;
  const candidates = [baseScore];

  if (sectionScore !== null && !allowEvidenceScoreBoost) {
    candidates.push(sectionScore);
  }

  if (scoreCap !== null) {
    candidates.push(scoreCap);
  }

  return {
    score: Math.min(...candidates),
    sectionScore,
    scoreCap,
  };
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeUnifiedAnalysisPayload(payload, context = {}) {
  const score = normalizeScore(payload?.score);

  if (score === null) {
    throw new Error('invalid_unified_analysis_score');
  }

  const rawSections = normalizeSections(payload?.sections);
  const criticalInsight = firstText(
    payload?.criticalInsight,
    payload?.critical_insight,
    buildCriticalInsightFromObject(payload?.priorityInsight || payload?.priority_insight),
  );
  const message = firstText(
    payload?.message,
    payload?.scoreLabel,
    payload?.score_label,
    `Estrutura avaliada com nota ${score}/100.`,
  );
  const justification = firstText(
    payload?.justification,
    payload?.summary,
    payload?.analysis,
  );
  const otherGaps = normalizeArray(payload?.otherGaps || payload?.other_gaps, 12);
  const confidence = normalizeConfidence(payload?.confidence);
  const contextText = [
    context.originalText,
    context.structuredText,
  ].filter(Boolean).join('\n');
  const sectionEvidenceGuard = applySectionEvidenceGuards(rawSections, contextText);
  const sections = sectionEvidenceGuard.sections;
  const recalibrated = recalibrateScore({
    score,
    sections,
    contextText,
    allowEvidenceScoreBoost: sectionEvidenceGuard.adjustments.length > 0,
  });
  let prioritized = prioritizeCriticalInsight({
    criticalInsight,
    justification,
    sections,
    contextText,
  });
  if (insightMatchesEvidenceAdjustment(prioritized.criticalInsight, sectionEvidenceGuard.adjustments)) {
    prioritized = buildResolvedInsightFallback({
      sections,
      contextText,
      fallbackJustification: prioritized.justification,
    });
  }
  const unresolvedOtherGaps = removeResolvedOtherGaps(otherGaps, sectionEvidenceGuard.adjustments);
  const prioritizedOtherGaps = prioritizeOtherGaps(unresolvedOtherGaps, prioritized.criticalInsight, contextText).slice(0, 4);
  const finalScore = recalibrated.score;
  const scoreLabel = getScoreLabel(finalScore);
  const scoreAdjusted = finalScore !== score;
  const scoreRaisedByEvidence = finalScore > score;

  if (!message || !justification || !criticalInsight) {
    throw new Error('incomplete_unified_analysis_payload');
  }

  return {
    score: finalScore,
    interpretation: {
      message: scoreAdjusted
        ? scoreRaisedByEvidence
          ? `${scoreLabel}. Seções reconhecidas no texto corrigiram a leitura da nota final.`
          : `${scoreLabel}. Lacunas estruturais relevantes limitaram a nota final.`
        : message,
      justification: prioritized.justification,
      criticalInsight: prioritized.criticalInsight,
      otherGaps: prioritizedOtherGaps,
    },
    unifiedAnalysis: {
      score: finalScore,
      rawScore: score,
      sectionScore: recalibrated.sectionScore,
      scoreCap: recalibrated.scoreCap,
      scoreAdjusted,
      scoreLabel,
      confidence,
      sections,
      otherGaps: prioritizedOtherGaps,
      priorityInsightAdjusted: prioritized.adjusted,
      sectionEvidenceAdjusted: sectionEvidenceGuard.adjustments.length > 0,
      sectionEvidenceAdjustments: sectionEvidenceGuard.adjustments,
    },
  };
}

function parseUnifiedAnalysisResponse(rawText, context = {}) {
  return normalizeUnifiedAnalysisPayload(extractJsonObject(rawText), context);
}

module.exports = {
  parseUnifiedAnalysisResponse,
  normalizeUnifiedAnalysisPayload,
};
