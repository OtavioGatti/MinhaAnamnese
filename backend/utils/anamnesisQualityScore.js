const { getTemplateById } = require('../services/templates');

const MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL = 85;
const MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS = 70;
const MAX_SCORE_WITH_CRITICAL_CONTEXTUAL_GAP = 60;
const MISSING_MARKERS = [
  'nao informado',
  'não informado',
  'nao descrito',
  'não descrito',
  '[dado ausente]',
  '[informacao insuficiente]',
  '[informação insuficiente]',
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

  return !MISSING_MARKERS.some((marker) => normalized.includes(normalizeText(marker)));
}

function getTemplateEvaluationConfig(templateId, templateConfig) {
  const resolvedTemplate = templateConfig || getTemplateById(templateId);
  return resolvedTemplate?.evaluation || null;
}

function getLabeledFieldValue(text, aliases) {
  const matches = text.replace(/\r/g, '').matchAll(/(^|[\n])\s*([^:\n]{2,80})\s*:\s*([^\n]*)/g);

  for (const match of matches) {
    const label = normalizeText(match[2]);

    if (aliases.some((alias) => label.includes(normalizeText(alias)))) {
      return match[3] || '';
    }
  }

  return null;
}

function countMatches(text, entries = []) {
  const normalizedText = normalizeText(text);
  return entries.filter((entry) => normalizedText.includes(normalizeText(entry))).length;
}

function evaluateNarrativeDensity(text) {
  const tokens = tokenizeText(text);
  const temporalMarkers = countMatches(text, [
    'desde',
    'ha ',
    'há ',
    'inicio',
    'início',
    'evolucao',
    'evolução',
    'piora',
    'melhora',
    'progressivo',
    'subito',
    'súbito',
  ]);
  const qualifierMarkers = countMatches(text, [
    'intenso',
    'intensa',
    'discreto',
    'discreta',
    'associado',
    'associada',
    'irradiacao',
    'irradiação',
    'intermitente',
    'contínuo',
    'continuo',
  ]);

  if (tokens.length >= 20 && temporalMarkers >= 2) {
    return 'present';
  }

  if (tokens.length >= 10 && (temporalMarkers >= 1 || qualifierMarkers >= 2)) {
    return 'partial';
  }

  return 'missing';
}

function evaluateVitalsDensity(text) {
  const vitalsMatches = countMatches(text, [
    'pa',
    'pressao arterial',
    'pressão arterial',
    'fc',
    'fr',
    'temperatura',
    'tax',
    'saturacao',
    'saturação',
    'spo2',
    'bcf',
  ]);

  if (vitalsMatches >= 3) {
    return 'present';
  }

  if (vitalsMatches >= 1) {
    return 'partial';
  }

  return 'missing';
}

function getPresenceStatus(sectionValue, sectionDefinition, fullText) {
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

  if (sectionDefinition.narrative) {
    const narrativeStatus = evaluateNarrativeDensity(fullText);

    if (narrativeStatus === 'present' && (aliasMatches > 0 || evidenceMatches > 0)) {
      return 'present';
    }

    if (narrativeStatus === 'partial' && (aliasMatches > 0 || evidenceMatches > 0)) {
      return 'partial';
    }
  }

  if (sectionDefinition.vitals) {
    const vitalsStatus = evaluateVitalsDensity(fullText);

    if (vitalsStatus !== 'missing' && (aliasMatches > 0 || evidenceMatches > 0)) {
      return vitalsStatus;
    }
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
    return 0.55;
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

function mapPriorityToBucket(priority) {
  if (priority === 'essential') {
    return 'essenciais';
  }

  if (priority === 'important') {
    return 'importantes';
  }

  return 'secundarias';
}

function buildSectionResult(fullText, sectionDefinition) {
  const status = getPresenceStatus('', sectionDefinition, fullText);

  return {
    id: sectionDefinition.id,
    label: sectionDefinition.label,
    priority: sectionDefinition.priority,
    weight: sectionDefinition.weight,
    status,
    coverage: getCoverageStatus(status),
    scoreContribution: Number((sectionDefinition.weight * getStatusWeightMultiplier(status)).toFixed(1)),
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

  if (hmaSection && hmaSection.status !== 'present') {
    factors.push('Texto com sinal potencialmente relevante sem detalhamento suficiente da história atual');
  }

  if (examSection && examSection.status === 'missing') {
    factors.push('Texto com possível gravidade sem exame físico ou sinais objetivos suficientes para leitura segura');
  }

  if ((byId.sinais_alarme && byId.sinais_alarme.status === 'missing') || (byId.sinais_gravidade && byId.sinais_gravidade.status === 'missing')) {
    factors.push('Faltou registrar sinais de alarme ou gravidade apesar de haver pistas de maior risco no texto');
  }

  return factors;
}

function buildStructuredAnalysis(sectionResults, contextualSeverityFactors) {
  const coverageBySection = Object.fromEntries(
    sectionResults.map((section) => [section.id, section.coverage]),
  );

  const essentialGaps = sectionResults
    .filter((section) => section.priority === 'essential' && section.status !== 'present')
    .map((section) => `${section.label} ${section.status === 'partial' ? 'parcial' : 'ausente'}`);

  const importantGaps = sectionResults
    .filter((section) => section.priority === 'important' && section.status !== 'present')
    .map((section) => `${section.label} ${section.status === 'partial' ? 'parcial' : 'ausente'}`);

  const secondaryGaps = sectionResults
    .filter((section) => section.priority === 'contextual' && section.status !== 'present')
    .map((section) => `${section.label} ${section.status === 'partial' ? 'parcial' : 'ausente'}`);

  return {
    coverageBySection,
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

  let nextScore = score;

  if (essentialMissingCount === 1) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL);
  } else if (essentialMissingCount >= 2) {
    nextScore = Math.min(nextScore, MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS);
  }

  if (contextualSeverityFactors.length > 0) {
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
