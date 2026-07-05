// Cruzamento entre a prescrição gerada e o dicionário de medicamentos.
//
// - Extrai os medicamentos de texto_copiavel_prescricao (formato
//   "[N] Medicamento dose ---- instrução").
// - Faz fuzzy matching contra o dicionário (sem dependências).
// - Produz um RELATÓRIO separado (disponivel | em_falta | nao_encontrado).
//
// NUNCA reescreve o texto clínico — só reporta.

const { normalizeForMatch, similarityScore } = require('../utils/stringSimilarity');
const { getMedicationDictionary } = require('./medicationDictionary');

const DEFAULT_MATCH_THRESHOLD = 0.6;
const DOSE_TOKEN = /\b\d+([.,]\d+)?\s*(mg|mcg|g|ml|mL|ui|UI|%|mg\/ml)\b/i;

function stripLeadingIndex(line) {
  // Remove marcadores "[1]", "1.", "1)", "- " no começo da linha.
  const match = String(line).match(/^\s*(?:\[(\d{1,2})\]|(\d{1,2})[.)])\s*(.*)$/);

  if (match) {
    return { index: Number(match[1] || match[2]), rest: String(match[3] || '').trim() };
  }

  return { index: null, rest: String(line).trim() };
}

function splitOnSeparator(rest) {
  // Separador entre "Nome dose" e a instrução: 3+ hifens (com ou sem travessão).
  const parts = String(rest).split(/-{3,}[—–-]*/);
  const nameAndDose = parts[0].trim();
  const instruction = parts.slice(1).join(' ').replace(/\s+/g, ' ').trim();
  return { nameAndDose, instruction };
}

function extractNameAndDose(nameAndDose) {
  const doseMatch = String(nameAndDose).match(DOSE_TOKEN);

  if (doseMatch && doseMatch.index > 0) {
    return {
      name: nameAndDose.slice(0, doseMatch.index).trim().replace(/[,;]+$/, '').trim(),
      dose: nameAndDose.slice(doseMatch.index).trim(),
    };
  }

  return { name: nameAndDose.replace(/[,;]+$/, '').trim(), dose: '' };
}

/**
 * Extrai a lista de medicamentos de um texto de prescrição.
 * Retorna [{ index, raw, name, dose, instruction }] (só linhas com nome).
 */
function parsePrescriptionMedications(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const medications = [];

  for (const line of lines) {
    const { index, rest } = stripLeadingIndex(line);

    // Considera apenas linhas que parecem itens de prescrição (numeradas ou com dose).
    if (index === null && !DOSE_TOKEN.test(rest)) {
      continue;
    }

    const { nameAndDose, instruction } = splitOnSeparator(rest);
    const { name, dose } = extractNameAndDose(nameAndDose);

    if (!name) {
      continue;
    }

    medications.push({ index, raw: line, name, dose, instruction });
  }

  return medications;
}

function tokenOverlapScore(a, b) {
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = new Set(b.split(' ').filter(Boolean));

  if (tokensA.length === 0 || tokensB.size === 0) {
    return 0;
  }

  const intersection = tokensA.filter((token) => tokensB.has(token)).length;
  return intersection / Math.min(tokensA.length, tokensB.size);
}

function scoreAgainst(normalizedName, target) {
  if (!target) {
    return 0;
  }

  return Math.max(
    similarityScore(normalizedName, target),
    tokenOverlapScore(normalizedName, target),
  );
}

/**
 * Melhor correspondência de um nome no dicionário.
 * Retorna { record, score } (record null se dicionário vazio).
 */
function matchMedication(name, dictionary) {
  const normalizedName = normalizeForMatch(name);
  let best = { record: null, score: 0 };

  for (const record of dictionary) {
    const score = Math.max(
      scoreAgainst(normalizedName, record.match?.nome),
      scoreAgainst(normalizedName, record.match?.principio_ativo),
    );

    if (score > best.score) {
      best = { record, score };
    }
  }

  return best;
}

/**
 * Relatório de disponibilidade de uma prescrição contra o dicionário.
 * classificacao por item: 'disponivel' | 'em_falta' | 'nao_encontrado'.
 */
function buildAvailabilityReport(prescriptionText, options = {}) {
  const dictionary = options.dictionary || getMedicationDictionary();
  const threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_MATCH_THRESHOLD;
  const medications = parsePrescriptionMedications(prescriptionText);

  const items = [];
  // Itens [n] que são ações/orientações (ex.: "Manter ouvido seco",
  // "Encaminhamento"), não medicamentos — ficam fora do cruzamento.
  const naoMedicamentos = [];

  for (const medication of medications) {
    const { record, score } = matchMedication(medication.name, dictionary);
    const matched = Boolean(record) && score >= threshold;
    const hasDose = Boolean(medication.dose);

    // Sem correspondência e sem dose = linha de ação, não é remédio: ignora.
    if (!matched && !hasDose) {
      naoMedicamentos.push(medication.name);
      continue;
    }

    items.push({
      index: medication.index,
      nome_prescrito: medication.name,
      dose: medication.dose,
      classificacao: matched
        ? (record.status === 'em_falta' ? 'em_falta' : 'disponivel')
        : 'nao_encontrado',
      score: Number(score.toFixed(3)),
      correspondencia: matched
        ? {
            nome: record.nome,
            principio_ativo: record.principio_ativo,
            apresentacao: record.apresentacao,
            fonte: record.fonte,
            status: record.status,
            unidade: record.unidade,
            atualizado_em: record.atualizado_em,
          }
        : null,
    });
  }

  const summary = {
    total: items.length,
    disponivel: items.filter((item) => item.classificacao === 'disponivel').length,
    em_falta: items.filter((item) => item.classificacao === 'em_falta').length,
    nao_encontrado: items.filter((item) => item.classificacao === 'nao_encontrado').length,
  };

  return {
    summary,
    items,
    naoMedicamentos,
    threshold,
    dictionarySize: dictionary.length,
  };
}

module.exports = {
  DEFAULT_MATCH_THRESHOLD,
  parsePrescriptionMedications,
  matchMedication,
  tokenOverlapScore,
  buildAvailabilityReport,
};
