// Casa uma seção de template custom (rótulo livre do usuário) com a seção
// oficial mais próxima, para herdar aliases/evidence/peso/prioridade e a
// orientação clínica curada — em vez de gerar tudo só a partir do rótulo.

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP_TOKENS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na',
  'para', 'por', 'com', 'the', 'of',
]);

function tokenize(value) {
  return normalizeLabel(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_TOKENS.has(token));
}

function tokenOverlapScore(customTokens, officialTokens) {
  if (!customTokens.length || !officialTokens.length) {
    return 0;
  }

  const officialSet = new Set(officialTokens);
  let shared = 0;

  for (const token of new Set(customTokens)) {
    if (officialSet.has(token)) {
      shared += 1;
    }
  }

  const union = new Set([...customTokens, ...officialTokens]).size;
  return union ? shared / union : 0;
}

// Pontua o quão bem um rótulo custom bate com uma seção oficial (0..1).
function scoreOfficialSectionMatch(customLabel, officialSection) {
  const normalizedCustom = normalizeLabel(customLabel);

  if (!normalizedCustom) {
    return 0;
  }

  const candidates = [
    officialSection?.label,
    ...(Array.isArray(officialSection?.aliases) ? officialSection.aliases : []),
  ]
    .map(normalizeLabel)
    .filter(Boolean);

  if (candidates.includes(normalizedCustom)) {
    return 1;
  }

  const customTokens = tokenize(customLabel);
  let best = 0;

  for (const candidate of candidates) {
    // Contido um no outro (ex.: "queixa" ⊂ "queixa principal") vale bastante.
    if (candidate.includes(normalizedCustom) || normalizedCustom.includes(candidate)) {
      best = Math.max(best, 0.8);
    }

    best = Math.max(best, tokenOverlapScore(customTokens, tokenize(candidate)));
  }

  return best;
}

// Retorna a seção oficial mais próxima acima do limiar, ou null.
function matchOfficialSection(customLabel, officialSections = [], threshold = 0.34) {
  if (!Array.isArray(officialSections) || !officialSections.length) {
    return null;
  }

  let bestSection = null;
  let bestScore = 0;

  for (const officialSection of officialSections) {
    const score = scoreOfficialSectionMatch(customLabel, officialSection);

    if (score > bestScore) {
      bestScore = score;
      bestSection = officialSection;
    }
  }

  return bestScore >= threshold ? bestSection : null;
}

module.exports = {
  matchOfficialSection,
  normalizeLabel,
  scoreOfficialSectionMatch,
  tokenize,
};
