const CORRUPTED_TEXT_PATTERN = /[ÃÂ�]|ï¿½|â€|â€œ|â€|â€™/;

function countCorruptionMarkers(text) {
  const matches = String(text || '').match(/[ÃÂ�]|ï¿½|â€|â€œ|â€|â€™/g);
  return matches ? matches.length : 0;
}

function countReadableAccents(text) {
  const matches = String(text || '').match(/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g);
  return matches ? matches.length : 0;
}

function tryRepairMojibake(text) {
  const original = String(text || '');
  const repaired = Buffer.from(original, 'latin1').toString('utf8');

  const originalCorruption = countCorruptionMarkers(original);
  const repairedCorruption = countCorruptionMarkers(repaired);
  const originalReadable = countReadableAccents(original);
  const repairedReadable = countReadableAccents(repaired);

  if (repairedCorruption < originalCorruption) {
    return repaired;
  }

  if (repairedCorruption === originalCorruption && repairedReadable > originalReadable) {
    return repaired;
  }

  return original;
}

function sanitizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;

  if (CORRUPTED_TEXT_PATTERN.test(sanitized)) {
    sanitized = tryRepairMojibake(sanitized);
  }

  sanitized = sanitized.replace(/\uFFFD/g, '');
  sanitized = sanitized.normalize('NFC');

  return sanitized;
}

module.exports = {
  sanitizeText,
};
