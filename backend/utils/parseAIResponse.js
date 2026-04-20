const DEBUG_MODE = process.env.DEBUG_INSIGHTS === 'true';
const { sanitizeText } = require('./textSanitization');

function extractSection(text, section) {
  const normalizedText = sanitizeText(text);
  const regex = new RegExp(`\\[${section}\\]([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
  const match = normalizedText.match(regex);
  return match ? sanitizeText(match[1]).trim() : '';
}

function parseAIResponse(text) {
  const parsed = {
    analise: extractSection(text, "ANALISE"),
    scoreText: extractSection(text, "SCORE"),
    insight: extractSection(text, "INSIGHT"),
    outros: extractSection(text, "OUTROS"),
  };

  if (DEBUG_MODE) {
    console.log('parseAIResponse: parsed sections', {
      analise: Boolean(parsed.analise),
      scoreText: Boolean(parsed.scoreText),
      insight: Boolean(parsed.insight),
      outros: Boolean(parsed.outros),
    });
  }

  return parsed;
}

module.exports = { parseAIResponse };
