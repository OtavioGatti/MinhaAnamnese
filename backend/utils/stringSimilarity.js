// Similaridade de strings sem dependências externas (convenção: dependências
// mínimas). Usado no cruzamento de nomes de medicamentos contra o dicionário.

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Normaliza para comparação: sem acento, minúsculo, sem pontuação, espaços colapsados.
function normalizeForMatch(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de edição de Levenshtein (duas linhas, O(n*m) tempo / O(min) espaço).
function levenshtein(a, b) {
  const source = String(a || '');
  const target = String(b || '');

  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  let previous = Array.from({ length: target.length + 1 }, (_, i) => i);
  let current = new Array(target.length + 1);

  for (let i = 0; i < source.length; i += 1) {
    current[0] = i + 1;

    for (let j = 0; j < target.length; j += 1) {
      const cost = source[i] === target[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1, // inserção
        previous[j + 1] + 1, // remoção
        previous[j] + cost, // substituição
      );
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[target.length];
}

// Razão de Levenshtein normalizada em [0, 1] (1 = idêntico).
function levenshteinRatio(a, b) {
  const source = String(a || '');
  const target = String(b || '');
  const longest = Math.max(source.length, target.length);

  if (longest === 0) {
    return 1;
  }

  return 1 - levenshtein(source, target) / longest;
}

function bigrams(value) {
  const text = String(value || '').replace(/\s+/g, '');
  const pairs = new Map();

  for (let i = 0; i < text.length - 1; i += 1) {
    const pair = text.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  return pairs;
}

// Coeficiente de Sørensen–Dice sobre bigramas em [0, 1] (1 = idêntico).
// Robusto a ordem de palavras e pequenas variações de grafia.
function diceCoefficient(a, b) {
  const source = String(a || '').replace(/\s+/g, '');
  const target = String(b || '').replace(/\s+/g, '');

  if (source === target) {
    return source.length ? 1 : 0;
  }

  if (source.length < 2 || target.length < 2) {
    return 0;
  }

  const sourcePairs = bigrams(source);
  const targetPairs = bigrams(target);
  let intersection = 0;
  let sourceTotal = 0;

  sourcePairs.forEach((count, pair) => {
    sourceTotal += count;
    const targetCount = targetPairs.get(pair) || 0;
    intersection += Math.min(count, targetCount);
  });

  let targetTotal = 0;
  targetPairs.forEach((count) => {
    targetTotal += count;
  });

  return (2 * intersection) / (sourceTotal + targetTotal);
}

// Pontuação combinada em [0, 1]: pega o melhor entre Dice (grafia/ordem) e razão
// de Levenshtein (edições curtas). Espera entradas já normalizadas por quem chama.
function similarityScore(a, b) {
  return Math.max(diceCoefficient(a, b), levenshteinRatio(a, b));
}

module.exports = {
  stripAccents,
  normalizeForMatch,
  levenshtein,
  levenshteinRatio,
  diceCoefficient,
  similarityScore,
};
