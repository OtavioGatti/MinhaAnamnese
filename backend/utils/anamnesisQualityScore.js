const { getTemplateById } = require('../services/templates');

const MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL = 85;
const MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS = 70;
const MAX_SCORE_WITH_CRITICAL_CONTEXTUAL_GAP = 60;
const MAX_SCORE_WITH_ONE_PARTIAL_ESSENTIAL = 88;
const MAX_SCORE_WITH_MULTIPLE_PARTIAL_ESSENTIALS = 80;
const MAX_SCORE_WITH_EMERGENCY_STRUCTURAL_RISK = 74;
const PARTIAL_STATUS_MULTIPLIER = 0.72;
const MISSING_MARKERS = [
  'nao informado',
  'nao descrito',
  '[dado ausente]',
  '[informacao insuficiente]',
];
const INLINE_FIELD_ALIASES = [
  'id',
  'identificacao',
  'identificação',
  'hd',
  'qp',
  'qpd',
  'hma',
  'hda',
  'hp',
  'ap',
  'hf',
  'af',
  'hv',
  'muc',
  'isda',
  'exames',
  'exame fisico',
  'exame físico',
  'ex. fisico',
  'ex. físico',
  'ao exame',
  'historia pregressa',
  'história pregressa',
  'historia familiar',
  'história familiar',
  'antecedentes pessoais',
  'antecedentes familiares',
  'doencas de base',
  'doenças de base',
  'comorbidades',
  'sinais de alarme',
  'sintomas associados',
  'tempo de evolucao',
  'tempo de evolução',
  'vacinacao',
  'vacinação',
  'ig',
  'dum',
  'usg',
  'h. obstetrico',
  'h. obstétrico',
  'alergia',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenizeText(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function hasMeaningfulContent(value) {
  const normalized = normalizeText(value).trim();

  if (!normalized) {
    return false;
  }

  return !MISSING_MARKERS.some((marker) => normalized.includes(marker));
}

function getTemplateEvaluationConfig(templateId, templateConfig) {
  const resolvedTemplate = templateConfig || getTemplateById(templateId);
  return resolvedTemplate?.evaluation || null;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimValueAtNextInlineLabel(value) {
  const sanitizedValue = String(value || '').trim();
  const nextLabelPattern = INLINE_FIELD_ALIASES
    .map((entry) => escapeRegex(entry))
    .join('|');
  const nextLabelRegex = new RegExp(`(?:^|[\\n]|\\.\\s+)(${nextLabelPattern})\\s*:\\s*`, 'i');
  const nextLabelMatch = nextLabelRegex.exec(sanitizedValue);

  if (!nextLabelMatch) {
    return sanitizedValue;
  }

  return sanitizedValue.slice(0, nextLabelMatch.index).trim();
}

function getLabeledFieldValue(text, aliases) {
  const sanitizedText = String(text || '').replace(/\r/g, '');
  const matches = sanitizedText.matchAll(/(^|[\n])\s*([^:\n]{2,80})\s*:\s*([^\n]*)/g);

  for (const match of matches) {
    const label = normalizeText(match[2]);

    if (aliases.some((alias) => label.includes(normalizeText(alias)))) {
      return trimValueAtNextInlineLabel(match[3] || '');
    }
  }

  for (const alias of aliases) {
    const startRegex = new RegExp(`(?:^|[\\n]|\\.\\s+)(${escapeRegex(alias)})\\s*:\\s*`, 'i');
    const startMatch = startRegex.exec(sanitizedText);

    if (!startMatch) {
      continue;
    }

    const contentStart = startMatch.index + startMatch[0].length;
    const remainingText = sanitizedText.slice(contentStart);
    return trimValueAtNextInlineLabel(remainingText);
  }

  return null;
}

function getLabeledFieldValueByLabels(text, labels = []) {
  return getLabeledFieldValue(text, labels);
}

function countMatches(text, entries = []) {
  const normalizedText = normalizeText(text);
  return entries.filter((entry) => normalizedText.includes(normalizeText(entry))).length;
}

function countRegexMatches(text, patterns = []) {
  const normalizedText = normalizeText(text);
  return patterns.filter((pattern) => new RegExp(pattern, 'i').test(normalizedText)).length;
}

function hasAgeMarker(text) {
  return countRegexMatches(text, [
    '\\b\\d{1,3}\\s*(anos|ano|meses|mes)\\b',
  ]) > 0;
}

function hasSexMarker(text) {
  return countRegexMatches(text, [
    '\\b(masculino|feminino|gestante|lactente|crianca|paciente)\\b',
  ]) > 0;
}

function hasSymptomSignal(text) {
  return countRegexMatches(text, [
    '\\b(dor|febre|tosse|dispneia|cefaleia|tontura|nausea|vomito|coriza|sudorese|palpitacao|falta de ar|sangramento|saida de liquido)\\b',
  ]);
}

function countSymptomDetails(text) {
  return countRegexMatches(text, [
    '\\bdor\\b',
    '\\bfebre\\b',
    '\\btosse\\b',
    '\\bdispneia\\b',
    '\\bcefaleia\\b',
    '\\btontura\\b',
    '\\bnausea\\b',
    '\\bvomito\\b',
    '\\bcoriza\\b',
    '\\bsudorese\\b',
    '\\bpalpitacao\\b',
    '\\bfalta de ar\\b',
    '\\bsangramento\\b',
    '\\bsaida de liquido\\b',
  ]);
}

function hasMedicationSignal(text) {
  return countRegexMatches(text, [
    '\\b(usa|uso|em uso|faz uso|tomando|toma|recebeu|recebe)\\b',
    '\\b\\d+\\s*(mg|mcg|g|ml|ui|gotas|comprimidos?|capsulas?)\\b',
    '\\b(losartana|metformina|captopril|dipirona|paracetamol|ibuprofeno|insulina|sertralina|fluoxetina|clonazepam|sulfato ferroso|acido folico)\\b',
  ]);
}

function hasDiseaseSignal(text) {
  return countRegexMatches(text, [
    '\\bhipertens[a-z]*\\b',
    '\\bdiabet[a-z]*\\b',
    '\\bhas\\b',
    '\\bdm\\d*\\b',
    '\\bdrc\\b',
    '\\bdpoc\\b',
    '\\basma\\b',
    '\\bepilepsia\\b',
    '\\bcardiopat[a-z]*\\b',
    '\\bdislipidemia\\b',
    '\\bobesidade\\b',
    '\\bcomorbidades?\\b',
  ]);
}

function hasPastHistorySignal(text) {
  return countRegexMatches(text, [
    'internac',
    'cirurg',
    'alerg',
    'prematur',
    'nascid',
    'a termo',
    'pre natal',
    'parto',
    'abort',
    'antecedent',
  ]);
}

function hasFamilyHistorySignal(text) {
  return countRegexMatches(text, [
    '\\b(mae|pai|irmao|irma|familia|familiar)\\b',
  ]);
}

function hasLifestyleSignal(text) {
  return countRegexMatches(text, [
    '\\b(tabag|etilis|alcool|sedentar|atividade fisica)\\b',
  ]);
}

function hasObstetricMedicationSignal(text) {
  return countRegexMatches(text, [
    '\\b(sulfato ferroso|acido folico|vitamina|suplemento|progesterona|medicamento|medicacao)\\b',
  ]);
}

function hasExamMention(text) {
  return countRegexMatches(text, [
    '\\b(sem exames|nao trouxe exames|trouxe exames|hemograma|ecg|rx|raio x|tomografia|ressonancia|usg|ultrassom|exames?)\\b',
  ]);
}

function hasExamDescriptor(text) {
  return countRegexMatches(text, [
    '\\b(ausculta|corado|hidratado|abdome|neurologic|otoscopia|dinamica uterina|altura uterina|mamas|especular|toque)\\b',
    '\\b(afebril|normocorado|eupneico|eupneica)\\b',
    '\\b(dispneic\\w*|uso de musculatura acessoria|uso de musculatura acess\\w*|edema|sopros?|mv presente)\\b',
  ]);
}

function hasAlarmSignal(text) {
  return countRegexMatches(text, [
    '\\b(confusao mental|confusão mental|prostracao|prostração|letargia|uso de musculatura acessoria|uso de musculatura acessória|fala frases curtas|cianose|dessatur|sat\\s*88|sat\\s*89|sat\\s*90|rigidez de nuca|arroxeamento|escurecimento visual|quase sincope|quase síncope)\\b',
    '\\b(rebaixamento|choque|convuls|hemorragia|hipotensao|hipotensão)\\b',
  ]);
}

function countAlarmSignalDetails(text) {
  return countRegexMatches(text, [
    '\\bconfusao mental\\b',
    '\\bprostracao\\b',
    '\\bletargia\\b',
    '\\buso de musculatura acessoria\\b',
    '\\bfala frases curtas\\b',
    '\\bcianose\\b',
    '\\bdessatur\\w*\\b',
    '\\bsat\\s*88\\b',
    '\\bsat\\s*89\\b',
    '\\bsat\\s*90\\b',
    '\\brigidez de nuca\\b',
    '\\barroxeamento\\b',
    '\\bescurecimento visual\\b',
    '\\bquase sincope\\b',
    '\\brebaixamento\\b',
    '\\bchoque\\b',
    '\\bconvuls\\w*\\b',
    '\\bhemorragia\\b',
    '\\bhipotensao\\b',
  ]);
}

function evaluateNarrativeDensity(text) {
  const tokens = tokenizeText(text);
  const temporalMarkers = countMatches(text, [
    'desde',
    'ha ',
    'inicio',
    'iniciad',
    'evolucao',
    'piora',
    'melhora',
    'progressivo',
    'subito',
    'hora',
    'dias',
    'semanas',
  ]);
  const qualifierMarkers = countMatches(text, [
    'intenso',
    'intensa',
    'discreto',
    'discreta',
    'associado',
    'associada',
    'irradiacao',
    'intermitente',
    'continuo',
    'aperto',
    'quantidade',
    'reducao',
  ]);
  const symptomMarkers = hasSymptomSignal(text);

  if ((tokens.length >= 14 && temporalMarkers >= 1 && (qualifierMarkers >= 1 || symptomMarkers >= 1)) || (tokens.length >= 20 && temporalMarkers >= 2)) {
    return 'present';
  }

  if ((tokens.length >= 8 && temporalMarkers >= 1) || (tokens.length >= 10 && qualifierMarkers >= 1) || (tokens.length >= 12 && symptomMarkers >= 2)) {
    return 'partial';
  }

  return 'missing';
}

function evaluateVitalsDensity(text) {
  const vitalsMatches = countMatches(text, [
    'pa',
    'pressao arterial',
    'fc',
    'fr',
    'temperatura',
    'tax',
    'saturacao',
    'spo2',
    'bcf',
  ]);
  const examDescriptors = hasExamDescriptor(text);
  const tokens = tokenizeText(text);

  if (vitalsMatches >= 3 || (vitalsMatches >= 2 && examDescriptors >= 1) || (vitalsMatches >= 2 && tokens.length >= 12)) {
    return 'present';
  }

  if (vitalsMatches >= 1 || examDescriptors >= 1) {
    return 'partial';
  }

  return 'missing';
}

function inferSectionStatusFromFreeText(fullText, sectionDefinition) {
  const sectionId = sectionDefinition.id;

  if (sectionDefinition.narrative) {
    return evaluateNarrativeDensity(fullText);
  }

  if (sectionDefinition.vitals) {
    return evaluateVitalsDensity(fullText);
  }

  if (sectionId === 'identificacao' || sectionId === 'id') {
    const idFieldValue = getLabeledFieldValueByLabels(fullText, ['id', 'identificacao', 'identificação']);

    if (hasMeaningfulContent(idFieldValue)) {
      return 'present';
    }

    if (hasAgeMarker(fullText) && hasSexMarker(fullText)) {
      return 'present';
    }

    if (hasAgeMarker(fullText) || hasSexMarker(fullText)) {
      return 'partial';
    }
  }

  if (sectionId === 'queixa_principal' || sectionId === 'qpd') {
    const symptomSignals = Math.max(hasSymptomSignal(fullText), countSymptomDetails(fullText));
    const tokenCount = tokenizeText(fullText).length;

    if (symptomSignals >= 1 && tokenCount >= 8) {
      return 'present';
    }

    if (symptomSignals >= 1 || tokenCount >= 5) {
      return 'partial';
    }
  }

  if (sectionId === 'tempo_evolucao' || sectionId === 'tempo_inicio' || sectionId === 'tempo_pos_parto') {
    if (countRegexMatches(fullText, [
      '\\b\\d+\\s*(hora|horas|dia|dias|semana|semanas|mes|meses)\\b',
      '\\bha\\b',
      '\\bdesde\\b',
      '\\biniciad',
      '\\binicio\\b',
    ]) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'medicacoes' || sectionId === 'muc') {
    const medicationFieldValue = getLabeledFieldValueByLabels(fullText, ['muc', 'medicacoes em uso', 'medicações em uso']);
    const medicationSignals = hasMedicationSignal(fullText);

    if (hasMeaningfulContent(medicationFieldValue)) {
      return 'present';
    }

    if (medicationSignals >= 2) {
      return 'present';
    }

    if (medicationSignals >= 1) {
      return 'partial';
    }
  }

  if (sectionId === 'doencas_base' || sectionId === 'comorbidades') {
    const hdValue = getLabeledFieldValueByLabels(fullText, ['hd', 'doencas de base', 'doenças de base', 'comorbidades']);
    const diseaseSignals = hasDiseaseSignal(fullText);

    if (hasMeaningfulContent(hdValue) && (hasDiseaseSignal(hdValue) >= 1 || hdValue.includes('/'))) {
      return 'present';
    }

    if (diseaseSignals >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'historia_pregressa' || sectionId === 'antecedentes_pessoais' || sectionId === 'historia_obstetrica') {
    const pastFieldAliases = sectionId === 'historia_obstetrica'
      ? ['h. obstetrico', 'h. obstétrico', 'historia obstetrica', 'história obstétrica']
      : ['hp', 'historia pregressa', 'história pregressa', 'ap', 'antecedentes pessoais'];
    const pastFieldValue = getLabeledFieldValueByLabels(fullText, pastFieldAliases);

    if (hasMeaningfulContent(pastFieldValue)) {
      return 'present';
    }

    if (hasPastHistorySignal(fullText) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'historia_familiar' || sectionId === 'antecedentes_familiares') {
    const familyFieldValue = getLabeledFieldValueByLabels(fullText, ['hf', 'af', 'historia familiar', 'história familiar', 'antecedentes familiares']);

    if (hasMeaningfulContent(familyFieldValue)) {
      return 'present';
    }

    if (hasFamilyHistorySignal(fullText) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'habitos_vida' || sectionId === 'hv') {
    if (sectionId === 'hv' && hasObstetricMedicationSignal(fullText) >= 1 && hasLifestyleSignal(fullText) === 0) {
      return 'missing';
    }

    if (hasLifestyleSignal(fullText) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'vacinacao') {
    if (countRegexMatches(fullText, ['\\b(vacinacao|vacinas|calendario vacinal)\\b']) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'sintomas_associados') {
    const associatedFieldValue = getLabeledFieldValueByLabels(fullText, ['sintomas associados']);
    const symptomSignals = Math.max(hasSymptomSignal(fullText), countSymptomDetails(fullText));

    if (hasMeaningfulContent(associatedFieldValue)) {
      return 'present';
    }

    if (symptomSignals >= 3) {
      return 'present';
    }

    if (symptomSignals >= 2) {
      return 'partial';
    }
  }

  if (sectionId === 'exames_complementares') {
    if (hasExamMention(fullText) >= 1) {
      return 'present';
    }
  }

  if (sectionId === 'sinais_alarme' || sectionId === 'sinais_gravidade') {
    const alarmSignals = Math.max(hasAlarmSignal(fullText), countAlarmSignalDetails(fullText));

    if (alarmSignals >= 2) {
      return 'present';
    }

    if (alarmSignals >= 1) {
      return 'partial';
    }
  }

  return 'missing';
}

function getPresenceStatus(sectionDefinition, fullText) {
  const labeledValue = getLabeledFieldValue(fullText, sectionDefinition.aliases || []);

  if (labeledValue !== null) {
    if (!hasMeaningfulContent(labeledValue)) {
      return 'missing';
    }

    if (sectionDefinition.narrative) {
      return evaluateNarrativeDensity(labeledValue);
    }

    if (sectionDefinition.vitals) {
      return evaluateVitalsDensity(labeledValue);
    }

    return 'present';
  }

  const evidenceMatches = countMatches(fullText, sectionDefinition.evidence || []);
  const aliasMatches = countMatches(fullText, sectionDefinition.aliases || []);
  const inferredStatus = inferSectionStatusFromFreeText(fullText, sectionDefinition);

  if (inferredStatus !== 'missing') {
    return inferredStatus;
  }

  if (aliasMatches > 0 && evidenceMatches > 0) {
    return 'present';
  }

  if (aliasMatches > 0 || evidenceMatches > 0) {
    return 'partial';
  }

  return 'missing';
}

function getStatusWeightMultiplier(status) {
  if (status === 'present') {
    return 1;
  }

  if (status === 'partial') {
    return PARTIAL_STATUS_MULTIPLIER;
  }

  return 0;
}

function getCoverageStatus(status) {
  if (status === 'present') {
    return 'presente';
  }

  if (status === 'partial') {
    return 'parcial';
  }

  return 'ausente';
}

function getGapLabel(label, status) {
  if (status === 'partial') {
    return `${label} pouco detalhada`;
  }

  return `${label} ausente`;
}

function buildSectionResult(fullText, sectionDefinition) {
  const status = getPresenceStatus(sectionDefinition, fullText);

  return {
    id: sectionDefinition.id,
    label: sectionDefinition.label,
    priority: sectionDefinition.priority,
    weight: sectionDefinition.weight,
    status,
    coverage: getCoverageStatus(status),
    scoreContribution: Number((sectionDefinition.weight * getStatusWeightMultiplier(status)).toFixed(1)),
    gapLabel: status === 'present' ? null : getGapLabel(sectionDefinition.label, status),
  };
}

function detectContextualSeverityFactors(fullText, templateEvaluation, sectionResults) {
  const normalizedText = normalizeText(fullText);
  const signals = (templateEvaluation?.severitySignals || []).filter((signal) => normalizedText.includes(normalizeText(signal)));
  const byId = Object.fromEntries(sectionResults.map((section) => [section.id, section]));
  const factors = [];

  if (signals.length === 0) {
    return factors;
  }

  const hmaSection = byId.hma || byId.qpd || byId.tempo_evolucao;
  const examSection = byId.exame_fisico || byId.sinais_vitais || byId.sinais_alarme;
  const alarmSection = byId.sinais_alarme || byId.sinais_gravidade;

  if (hmaSection && hmaSection.status === 'missing') {
    factors.push('Texto com sinal potencialmente relevante sem detalhamento suficiente da hist\u00f3ria atual');
  }

  if (examSection && examSection.status === 'missing') {
    factors.push('Texto com poss\u00edvel gravidade sem exame f\u00edsico ou sinais objetivos suficientes para leitura segura');
  }

  if ((byId.sinais_alarme && byId.sinais_alarme.status === 'missing') || (byId.sinais_gravidade && byId.sinais_gravidade.status === 'missing')) {
    factors.push('Faltou registrar sinais de alarme ou gravidade apesar de haver pistas de maior risco no texto');
  }

  if (
    templateEvaluation?.sensitivity === 'emergency'
    && signals.length > 0
    && (
      alarmSection?.status === 'partial'
      || examSection?.status === 'partial'
      || (alarmSection?.status !== 'present' && examSection?.status !== 'present')
    )
  ) {
    factors.push('Quadro com potencial gravidade e sinais estruturais incompletos para leitura segura em urgencia');
  }

  return factors;
}

function buildStructuredAnalysis(sectionResults, contextualSeverityFactors) {
  const coverageBySection = Object.fromEntries(
    sectionResults.map((section) => [section.id, section.coverage]),
  );
  const sectionReadout = sectionResults.map((section) => ({
    id: section.id,
    label: section.label,
    priority: section.priority,
    status: section.status,
    coverage: section.coverage,
    gapLabel: section.gapLabel,
  }));

  const essentialGaps = sectionResults
    .filter((section) => section.priority === 'essential' && section.status !== 'present')
    .map((section) => section.gapLabel);

  const importantGaps = sectionResults
    .filter((section) => section.priority === 'important' && section.status !== 'present')
    .map((section) => section.gapLabel);

  const secondaryGaps = sectionResults
    .filter((section) => section.priority === 'contextual' && section.status !== 'present')
    .map((section) => section.gapLabel);

  return {
    coverageBySection,
    sectionReadout,
    secoesPresentes: sectionReadout.filter((section) => section.status === 'present').map((section) => section.label),
    secoesParciais: sectionReadout.filter((section) => section.status === 'partial').map((section) => section.label),
    secoesAusentes: sectionReadout.filter((section) => section.status === 'missing').map((section) => section.label),
    lacunasEssenciais: essentialGaps,
    lacunasImportantes: importantGaps,
    lacunasSecundarias: secondaryGaps,
    fatoresGravidadeEstrutural: contextualSeverityFactors,
    principaisLacunas: [...essentialGaps, ...importantGaps].slice(0, 3),
  };
}

function applyScoreCaps(score, sectionResults, contextualSeverityFactors) {
  const essentialMissingCount = sectionResults.filter(
    (section) => section.priority === 'essential' && section.status === 'missing',
  ).length;
  const essentialPartialCount = sectionResults.filter(
    (section) => section.priority === 'essential' && section.status === 'partial',
  ).length;

  let nextScore = score;
  const genericContextualFactors = contextualSeverityFactors.filter((factor) => !factor.includes('urgencia'));

  if (essentialMissingCount === 1) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL);
  } else if (essentialMissingCount >= 2) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS);
  }

  if (essentialMissingCount === 0 && essentialPartialCount === 1) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_ONE_PARTIAL_ESSENTIAL);
  } else if (essentialMissingCount === 0 && essentialPartialCount >= 2) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_MULTIPLE_PARTIAL_ESSENTIALS);
  }

  if (contextualSeverityFactors.some((factor) => factor.includes('urgencia'))) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_EMERGENCY_STRUCTURAL_RISK);
  }

  if (genericContextualFactors.length > 0) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_CRITICAL_CONTEXTUAL_GAP);
  }

  return nextScore;
}

function calculateAnamnesisQualityScore(text, templateId, templateConfig) {
  const rawText = String(text || '').trim();
  const evaluationConfig = getTemplateEvaluationConfig(templateId, templateConfig);

  if (!rawText || !evaluationConfig?.sections?.length) {
    return {
      score: null,
      sections: [],
      missingEssentialSections: [],
      structuredAnalysis: null,
    };
  }

  const sectionResults = evaluationConfig.sections.map((sectionDefinition) =>
    buildSectionResult(rawText, sectionDefinition),
  );

  const rawScore = sectionResults.reduce((total, section) => total + section.scoreContribution, 0);
  const contextualSeverityFactors = detectContextualSeverityFactors(rawText, evaluationConfig, sectionResults);
  const score = Math.round(applyScoreCaps(rawScore, sectionResults, contextualSeverityFactors));
  const structuredAnalysis = buildStructuredAnalysis(sectionResults, contextualSeverityFactors);

  return {
    score,
    sections: sectionResults,
    missingEssentialSections: structuredAnalysis.lacunasEssenciais,
    structuredAnalysis,
  };
}

module.exports = {
  calculateAnamnesisQualityScore,
};
