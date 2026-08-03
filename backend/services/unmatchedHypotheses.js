const { normalizeGuideMatchKey } = require('./prescriptionGuides');

// Backlog editorial: registra hipóteses diagnósticas que a IA gerou mas que não
// têm guia de prescrição correspondente. O dono consulta a tabela para decidir
// quais protocolos escrever primeiro (ver supabase/unmatched_diagnostic_hypotheses.sql).

// Teto por requisição: uma análise devolve no máximo 5 hipóteses, então isso só
// existe como proteção contra payload inesperado.
const MAX_RECORDED_PER_REQUEST = 5;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MIN_KEY_LENGTH = 3;

function getUnmatchedHypothesesConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isUnmatchedHypothesesStorageAvailable() {
  const { url, serviceRoleKey } = getUnmatchedHypothesesConfig();
  return Boolean(url && serviceRoleKey);
}

// Extrai as hipóteses sem guia casado, deduplicadas pela mesma chave usada no
// pareamento com as prescrições — assim o backlog fala a mesma língua do match.
function collectUnmatchedHypotheses(hypotheses) {
  const seen = new Set();
  const output = [];

  for (const hypothesis of Array.isArray(hypotheses) ? hypotheses : []) {
    if (hypothesis?.prescriptionGuide) {
      continue;
    }

    const displayName = String(hypothesis?.name || '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    const normalizedName = normalizeGuideMatchKey(displayName);

    if (normalizedName.length < MIN_KEY_LENGTH || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    output.push({ normalizedName, displayName });

    if (output.length >= MAX_RECORDED_PER_REQUEST) {
      break;
    }
  }

  return output;
}

async function callRecordRpc({ normalizedName, displayName }) {
  const { url, serviceRoleKey } = getUnmatchedHypothesesConfig();

  const response = await fetch(`${url}/rest/v1/rpc/record_unmatched_hypothesis`, {
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
    throw new Error('unmatched hypotheses storage request failed');
  }
}

// Best-effort: alimentar o backlog nunca pode derrubar nem atrasar a resposta
// clínica. Sem a tabela/função aplicada no Supabase, degrada em silêncio.
async function recordUnmatchedHypotheses(hypotheses) {
  const entries = collectUnmatchedHypotheses(hypotheses);

  if (entries.length === 0 || !isUnmatchedHypothesesStorageAvailable()) {
    return 0;
  }

  const results = await Promise.allSettled(entries.map(callRecordRpc));

  return results.filter((result) => result.status === 'fulfilled').length;
}

module.exports = {
  collectUnmatchedHypotheses,
  isUnmatchedHypothesesStorageAvailable,
  recordUnmatchedHypotheses,
};
