const SECTION_CONFIG = [
  {
    id: 'identificacao',
    label: 'Identificação',
    weight: 15,
    essential: true,
    aliases: ['identificacao', 'identificação', 'id'],
    evidence: ['anos', 'masculino', 'feminino', 'sexo', 'paciente'],
  },
  {
    id: 'queixa_principal',
    label: 'Queixa principal',
    weight: 15,
    essential: true,
    aliases: ['queixa principal', 'qp', 'qpd'],
    evidence: ['dor', 'febre', 'tosse', 'dispneia', 'cefaleia', 'vomitos', 'vômitos', 'nausea', 'náusea'],
  },
  {
    id: 'hda',
    label: 'HDA',
    weight: 20,
    essential: true,
    aliases: ['hda', 'historia da doenca atual', 'história da doença atual', 'evolucao', 'evolução'],
    evidence: ['ha ', 'há ', 'desde', 'inicio', 'início', 'evolucao', 'evolução', 'piora', 'melhora'],
  },
  {
    id: 'antecedentes',
    label: 'Antecedentes',
    weight: 15,
    essential: true,
    aliases: ['antecedentes', 'comorbidades', 'historia pregressa', 'história pregressa'],
    evidence: ['hipertensao', 'hipertensão', 'diabetes', 'cirurgia', 'alergia', 'alergias'],
  },
  {
    id: 'medicacoes',
    label: 'Medicações',
    weight: 15,
    essential: true,
    aliases: ['medicacoes', 'medicações', 'medicacoes em uso', 'medicações em uso', 'uso de medicacoes', 'uso de medicações', 'muc'],
    evidence: ['medicacao', 'medicação', 'medicamento', 'medicamentos', 'uso continuo', 'uso contínuo'],
  },
  {
    id: 'exame_fisico',
    label: 'Exame físico',
    weight: 20,
    essential: true,
    aliases: ['exame fisico', 'exame físico', 'ao exame', 'sinais vitais', 'ex. fisico', 'ex. físico'],
    evidence: ['pressao arterial', 'pressão arterial', 'fc', 'fr', 'saturacao', 'saturação', 'temperatura', 'ausculta'],
  },
];

const MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL = 85;
const MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS = 70;
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
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasMeaningfulContent(value) {
  const normalized = normalizeText(value).trim();

  if (!normalized) {
    return false;
  }

  return !MISSING_MARKERS.some((marker) => normalized.includes(normalizeText(marker)));
}

function getLabeledFieldValue(text, aliases) {
  const matches = text.replace(/\r/g, '').matchAll(/(^|[\n.])\s*([^:\n.]{2,60})\s*:\s*([^\n.]*)/g);

  for (const match of matches) {
    const label = normalizeText(match[2]);

    if (aliases.some((alias) => label.includes(normalizeText(alias)))) {
      return match[3] || '';
    }
  }

  return null;
}

function hasSectionContent(text, section) {
  const labeledValue = getLabeledFieldValue(text, section.aliases);

  if (labeledValue !== null) {
    return hasMeaningfulContent(labeledValue);
  }

  const normalizedText = normalizeText(text);
  const hasAlias = section.aliases.some((alias) => normalizedText.includes(normalizeText(alias)));
  const hasEvidence = section.evidence.some((alias) => normalizedText.includes(normalizeText(alias)));

  return hasAlias || hasEvidence;
}

function getCoverageStatus(present) {
  return present ? 'presente' : 'ausente';
}

function buildStructuredAnalysis(sectionResults) {
  const byId = Object.fromEntries(sectionResults.map((section) => [section.id, section]));
  const missingEssentials = sectionResults
    .filter((section) => section.essential && !section.present)
    .map((section) => section.label);

  return {
    identificacao: getCoverageStatus(byId.identificacao?.present),
    queixa_principal: getCoverageStatus(byId.queixa_principal?.present),
    hda: getCoverageStatus(byId.hda?.present),
    antecedentes: getCoverageStatus(byId.antecedentes?.present),
    medicacoes: getCoverageStatus(byId.medicacoes?.present),
    exame_fisico: getCoverageStatus(byId.exame_fisico?.present),
    coerencia: missingEssentials.length === 0 ? 'coerente' : 'parcial',
    blocos_essenciais_ausentes: missingEssentials,
    principais_lacunas: missingEssentials.length > 0
      ? missingEssentials.map((label) => `${label} ausente`)
      : ['Todos os blocos essenciais estão presentes'],
  };
}

function calculateAnamnesisQualityScore(text) {
  const rawText = (text || '').trim();

  if (!rawText) {
    return {
      score: null,
      sections: [],
      missingEssentialSections: [],
      structuredAnalysis: null,
    };
  }

  const sectionResults = SECTION_CONFIG.map((section) => ({
    id: section.id,
    label: section.label,
    essential: section.essential,
    present: hasSectionContent(rawText, section),
    weight: section.weight,
  }));

  const missingEssentialSections = sectionResults.filter((section) => section.essential && !section.present);
  const rawScore = sectionResults.reduce(
    (total, section) => total + (section.present ? section.weight : 0),
    0,
  );

  let score = rawScore;

  if (missingEssentialSections.length === 1) {
    score = Math.min(score, MAX_SCORE_WITH_ONE_MISSING_ESSENTIAL);
  } else if (missingEssentialSections.length >= 2) {
    score = Math.min(score, MAX_SCORE_WITH_MULTIPLE_MISSING_ESSENTIALS);
  }

  return {
    score: Math.round(score),
    sections: sectionResults,
    missingEssentialSections: missingEssentialSections.map((section) => section.label),
    structuredAnalysis: buildStructuredAnalysis(sectionResults),
  };
}

module.exports = {
  calculateAnamnesisQualityScore,
};
