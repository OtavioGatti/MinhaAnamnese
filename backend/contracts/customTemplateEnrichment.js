const VALID_PRIORITIES = ['essential', 'important', 'contextual', 'optional'];
const MAX_SECTIONS = 24;
const MAX_ALIASES = 8;
const MAX_EVIDENCE = 10;
const MAX_GUIDANCE = 6;
const MAX_SEVERITY_SIGNALS = 12;
const MAX_STRING_LENGTH = 120;

function cleanString(value) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_STRING_LENGTH);
}

function cleanStringList(value, max) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const output = [];

  for (const item of value) {
    const clean = cleanString(item);
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(clean);

    if (output.length >= max) {
      break;
    }
  }

  return output;
}

function normalizePriority(value) {
  const normalized = cleanString(value).toLowerCase();
  return VALID_PRIORITIES.includes(normalized) ? normalized : null;
}

// Normaliza a saída da IA para um formato seguro e limitado, casando cada
// seção enriquecida com um dos rótulos reais do template (a IA não pode
// inventar ou renomear seções).
function normalizeCustomTemplateEnrichment(raw, sectionLabels = []) {
  const allowedByNormalized = new Map(
    sectionLabels.map((label) => [cleanString(label).toLowerCase(), label]),
  );
  const rawSections = Array.isArray(raw?.sections) ? raw.sections : [];
  const usedLabels = new Set();
  const sections = [];

  for (const rawSection of rawSections) {
    const matchedLabel = allowedByNormalized.get(cleanString(rawSection?.label).toLowerCase());

    if (!matchedLabel || usedLabels.has(matchedLabel)) {
      continue;
    }

    usedLabels.add(matchedLabel);
    sections.push({
      label: matchedLabel,
      priority: normalizePriority(rawSection?.priority) || 'contextual',
      aliases: cleanStringList(rawSection?.aliases, MAX_ALIASES),
      evidence: cleanStringList(rawSection?.evidence, MAX_EVIDENCE),
      guidance: cleanStringList(rawSection?.guidance, MAX_GUIDANCE),
    });

    if (sections.length >= MAX_SECTIONS) {
      break;
    }
  }

  if (!sections.length) {
    return null;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    severitySignals: cleanStringList(raw?.severitySignals, MAX_SEVERITY_SIGNALS),
    sections,
  };
}

module.exports = {
  VALID_PRIORITIES,
  normalizeCustomTemplateEnrichment,
};
