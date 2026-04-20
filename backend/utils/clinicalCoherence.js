function normalizeText(text) {
  if (!text) return '';

  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function normalizeKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getSectionContent(fullText, sectionTitle, nextTitles) {
  const lines = String(fullText || '').replace(/\r/g, '').split('\n');
  const sectionKey = normalizeKey(sectionTitle);
  const nextKeys = nextTitles.map(normalizeKey);
  const startIndex = lines.findIndex((line) => normalizeKey(line).includes(sectionKey));

  if (startIndex === -1) {
    return '';
  }

  const collected = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const currentKey = normalizeKey(lines[index]);

    if (nextKeys.some((key) => currentKey.includes(key))) {
      break;
    }

    collected.push(lines[index]);
  }

  return collected.join('\n').trim();
}

function getFirstContentLine(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function buildInterpretationFromInsights(fullText, score) {
  const scoreBlock = getSectionContent(fullText, 'SCORE + JUSTIFICATIVA', ['INSIGHT PRINCIPAL', 'OUTROS PONTOS IDENTIFICADOS']);
  const insightBlock = getSectionContent(fullText, 'INSIGHT PRINCIPAL', ['OUTROS PONTOS IDENTIFICADOS']);
  const justificationLines = scoreBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^SCORE:\s*\d{1,3}\/100$/i.test(line));
  const message = getFirstContentLine(justificationLines.join('\n'));
  const justification = justificationLines.join(' ').trim();
  const criticalInsight = insightBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    score,
    shouldShowScore: typeof score === 'number' && !Number.isNaN(score),
    message,
    justification,
    criticalInsight,
    reasons: [],
    teaser: {
      shouldShowTeaser: Boolean(criticalInsight),
      message: criticalInsight,
    },
  };
}

function buildFullText(result) {
  return [
    result?.analysis,
    result?.structured,
    result?.scoreBlock,
    result?.insight,
    result?.extra,
    result?.insightBlock,
    result?.otherPointsBlock,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join('\n');
}

function ensureFullText(result) {
  if (typeof result === 'string') {
    return {
      fullText: String(result),
    };
  }

  if (result && typeof result.fullText === 'string') {
    return {
      ...(result || {}),
      fullText: result.fullText,
    };
  }

  return {
    ...(result || {}),
    fullText: normalizeText(result?.fullText || buildFullText(result || {})),
  };
}

function buildAnalysisResult(result) {
  return ensureFullText(result);
}

function enforceFixedScore(fullText, score) {
  const normalized = normalizeText(fullText);
  const targetLine = `SCORE: ${score}/100`;

  if (!normalized) {
    return normalized;
  }

  if (/SCORE:\s*\d{1,3}\/100/i.test(normalized)) {
    return normalized.replace(/SCORE:\s*\d{1,3}\/100/i, targetLine);
  }

  return normalized;
}

module.exports = {
  buildInterpretationFromInsights,
  buildAnalysisResult,
  buildFullText,
  enforceFixedScore,
  ensureFullText,
  normalizeText,
};
