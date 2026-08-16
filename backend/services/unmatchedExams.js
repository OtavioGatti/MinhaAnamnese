const { normalizeMatchKey } = require('../utils/clinicalAliasMatching');

// Backlog editorial dos exames: registra o que a IA sugeriu e o catálogo ainda
// não cobre. Espelha unmatchedManeuvers.js.

const MAX_RECORDED_PER_REQUEST = 12;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MIN_KEY_LENGTH = 3;

function getConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isUnmatchedExamsStorageAvailable() {
  const { url, serviceRoleKey } = getConfig();
  return Boolean(url && serviceRoleKey);
}

function collectUnmatchedExams(hypotheses) {
  const seen = new Set();
  const output = [];

  for (const hypothesis of Array.isArray(hypotheses) ? hypotheses : []) {
    const suggestions = Array.isArray(hypothesis?.complementaryExams)
      ? hypothesis.complementaryExams
      : [];

    for (const suggestion of suggestions) {
      if (suggestion?.exam) {
        continue;
      }

      const displayName = String(suggestion?.name || '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      const normalizedName = normalizeMatchKey(displayName);

      if (normalizedName.length < MIN_KEY_LENGTH || seen.has(normalizedName)) {
        continue;
      }

      seen.add(normalizedName);
      output.push({ normalizedName, displayName });

      if (output.length >= MAX_RECORDED_PER_REQUEST) {
        return output;
      }
    }
  }

  return output;
}

async function callRecordRpc({ normalizedName, displayName }) {
  const { url, serviceRoleKey } = getConfig();

  const response = await fetch(`${url}/rest/v1/rpc/record_unmatched_exam`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_normalized_name: normalizedName,
      p_display_name: displayName,
    }),
  });

  if (!response.ok) {
    throw new Error('unmatched exams storage request failed');
  }
}

// Best-effort: alimentar o backlog nunca pode derrubar nem atrasar a resposta
// clínica. Sem a tabela/função aplicada no Supabase, degrada em silêncio.
async function recordUnmatchedExams(hypotheses) {
  const entries = collectUnmatchedExams(hypotheses);

  if (entries.length === 0 || !isUnmatchedExamsStorageAvailable()) {
    return 0;
  }

  const results = await Promise.allSettled(entries.map(callRecordRpc));

  return results.filter((result) => result.status === 'fulfilled').length;
}

module.exports = {
  collectUnmatchedExams,
  isUnmatchedExamsStorageAvailable,
  recordUnmatchedExams,
};
