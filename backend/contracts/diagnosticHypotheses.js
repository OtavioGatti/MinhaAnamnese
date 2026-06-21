const DIAGNOSTIC_HYPOTHESES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'hypotheses', 'missingData', 'generalWarnings'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'insufficient_data'],
    },
    hypotheses: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'priority',
          'rationale',
          'supportingEvidence',
          'missingOrConflictingData',
          'differentiatingSteps',
          'redFlags',
        ],
        properties: {
          name: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['documented_problem', 'most_compatible', 'differential', 'cannot_miss'],
          },
          rationale: { type: 'string' },
          supportingEvidence: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
          missingOrConflictingData: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
          differentiatingSteps: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
          redFlags: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
        },
      },
    },
    missingData: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    generalWarnings: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string' },
    },
  },
};

const PRIORITIES = new Set([
  'documented_problem',
  'most_compatible',
  'differential',
  'cannot_miss',
]);

function normalizeText(value, maxLength = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeTextList(value, maxItems) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const items = [];

  for (const item of value) {
    const text = normalizeText(item);
    const key = text.toLocaleLowerCase('pt-BR');

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(text);

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

function normalizeHypothesis(value) {
  const name = normalizeText(value?.name, 160);

  if (!name) {
    return null;
  }

  return {
    name,
    priority: PRIORITIES.has(value?.priority) ? value.priority : 'differential',
    rationale: normalizeText(value?.rationale, 900),
    supportingEvidence: normalizeTextList(value?.supportingEvidence, 6),
    missingOrConflictingData: normalizeTextList(value?.missingOrConflictingData, 6),
    differentiatingSteps: normalizeTextList(value?.differentiatingSteps, 6),
    redFlags: normalizeTextList(value?.redFlags, 6),
  };
}

function normalizeDiagnosticHypotheses(value) {
  const hypotheses = Array.isArray(value?.hypotheses)
    ? value.hypotheses.map(normalizeHypothesis).filter(Boolean).slice(0, 5)
    : [];
  const requestedStatus = value?.status === 'ok' ? 'ok' : 'insufficient_data';
  const status = requestedStatus === 'ok' && hypotheses.length < 3
    ? 'insufficient_data'
    : requestedStatus;

  return {
    status,
    hypotheses,
    missingData: normalizeTextList(value?.missingData, 8),
    generalWarnings: normalizeTextList(value?.generalWarnings, 6),
  };
}

function buildRefusalResult(message) {
  return {
    status: 'refused',
    hypotheses: [],
    missingData: [],
    generalWarnings: [
      normalizeText(message, 500) || 'Não foi possível analisar esta história com segurança.',
    ],
  };
}

module.exports = {
  buildRefusalResult,
  DIAGNOSTIC_HYPOTHESES_SCHEMA,
  normalizeDiagnosticHypotheses,
};
