// Parser canônico do "ponto crítico" gerado pelo backend no formato:
//   FALHA -> ... -> CONSEQUENCIA NA LEITURA -> ... -> IMPACTO NA QUALIDADE -> ... -> ACAO DIRETA -> ...
// Único lugar do frontend que entende esse formato — InsightBlock e
// DetailedAnalysis consomem daqui (antes cada um tinha um parser divergente e
// a análise detalhada perdia o campo de ação).

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function cleanSegment(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function removeImperativePrefix(value) {
  return String(value || '')
    .replace(/^(inclua|detalhe|registre|descreva|acrescente)\s+/i, '')
    .trim();
}

const INSIGHT_LABELS = [
  ['FALHA', 'priority'],
  ['PONTO CRITICO', 'priority'],
  ['CONSEQUENCIA NA LEITURA', 'consequence'],
  ['IMPACTO NA QUALIDADE', 'impact'],
  ['ACAO DIRETA', 'action'],
  ['PROXIMO PASSO', 'action'],
];

function getInsightLabelKey(value) {
  const normalized = normalizeText(value).replace(/[:.-]+$/g, '');

  for (const [label, key] of INSIGHT_LABELS) {
    if (normalized === normalizeText(label)) {
      return key;
    }
  }

  return '';
}

function extractLabeledPrefix(value) {
  const normalized = normalizeText(value);

  for (const [label, key] of INSIGHT_LABELS) {
    const normalizedLabel = normalizeText(label);

    if (normalized === normalizedLabel) {
      return { key, rest: '' };
    }

    if (normalized.startsWith(`${normalizedLabel} `)) {
      return {
        key,
        rest: value.slice(label.length).replace(/^[:\s-]+/, '').trim(),
      };
    }
  }

  return { key: '', rest: value };
}

export function buildActionItems(actionText) {
  const sanitized = removeImperativePrefix(String(actionText || '').replace(/\.$/, ''))
    .replace(/\s+na proxima coleta$/i, '')
    .replace(/\s+na próxima coleta$/i, '')
    .trim();

  if (!sanitized) {
    return [];
  }

  const normalized = normalizeText(sanitized);
  const splitBy = normalized.includes(' e ')
    ? /\s+e\s+/i
    : sanitized.includes(';')
      ? ';'
      : sanitized.includes(',')
        ? ','
        : null;

  if (!splitBy) {
    return [sanitized];
  }

  return sanitized
    .split(splitBy)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCriticalInsight(insightText) {
  const fallbackText = cleanSegment(insightText);
  const parsed = {
    priority: '',
    consequence: '',
    impact: '',
    action: '',
  };
  let activeKey = '';
  const parts = fallbackText
    .replace(/[→⇒]/g, '->')
    .split(/\s*->\s*/)
    .map((part) => cleanSegment(part))
    .filter(Boolean);

  for (const part of parts) {
    const directKey = getInsightLabelKey(part);

    if (directKey) {
      activeKey = directKey;
      continue;
    }

    const labeledPart = extractLabeledPrefix(part);
    const targetKey = labeledPart.key || activeKey;
    const value = cleanSegment(labeledPart.rest);

    if (targetKey && value) {
      parsed[targetKey] = parsed[targetKey]
        ? `${parsed[targetKey]} ${value}`
        : value;
      activeKey = '';
      continue;
    }

    if (!parsed.priority) {
      parsed.priority = value || part;
    }
  }

  const isEmpty = !parsed.priority && !parsed.consequence && !parsed.impact && !parsed.action;

  return {
    priority: isEmpty ? fallbackText : parsed.priority,
    consequence: isEmpty ? '' : parsed.consequence,
    impact: isEmpty ? '' : parsed.impact,
    action: isEmpty ? '' : parsed.action,
    actionItems: isEmpty ? [] : buildActionItems(parsed.action),
    readingImpact: isEmpty
      ? ''
      : [parsed.consequence, parsed.impact].filter(Boolean).join(' '),
  };
}
