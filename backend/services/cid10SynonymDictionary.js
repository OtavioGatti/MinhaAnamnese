// Dicionário de sinônimos para a busca de CID-10.
//
// A tabela do DATASUS usa o termo técnico oficial ("Distúrbios do metabolismo de
// lipoproteínas"), e o médico digita o termo que usa no dia a dia
// ("dislipidemia") ou a sigla ("DRGE"). Este dicionário traduz o segundo no
// primeiro antes de consultar o banco.
//
// É curadoria manual e incompleta de propósito: cobre o que aparece com mais
// frequência, e o que faltar cai na parecença por trigrama (no SQL) e, por
// último, na expansão por IA. O caminho do arquivo pode ser sobrescrito por
// CID10_SYNONYMS_PATH.

const fs = require('fs');
const path = require('path');
const { normalizeForMatch } = require('../utils/stringSimilarity');

const DEFAULT_SYNONYMS_PATH = path.join(__dirname, '..', 'data', 'cid10_synonyms.json');
const MAX_EXPANSIONS = 3;

let cache = null;

function resolveSynonymsPath() {
  return process.env.CID10_SYNONYMS_PATH || DEFAULT_SYNONYMS_PATH;
}

function parseSynonyms(text) {
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    return new Map();
  }

  const map = new Map();

  for (const entry of parsed) {
    const key = normalizeForMatch(entry?.termo);
    const expansions = (Array.isArray(entry?.expandir_para) ? entry.expandir_para : [])
      .map((value) => normalizeForMatch(value))
      .filter(Boolean);

    if (!key || expansions.length === 0) {
      continue;
    }

    map.set(key, [...new Set(expansions)].slice(0, MAX_EXPANSIONS));
  }

  return map;
}

function loadCid10Synonyms(filePath) {
  const resolved = filePath || resolveSynonymsPath();
  return parseSynonyms(fs.readFileSync(resolved, 'utf8'));
}

// Um dicionário ausente ou malformado não pode derrubar a busca: sem ele a
// consulta literal e a parecença por trigrama continuam funcionando.
function getCid10Synonyms() {
  if (!cache) {
    try {
      cache = loadCid10Synonyms();
    } catch (error) {
      console.warn('cid10: dicionário de sinônimos indisponível', error?.message || error);
      cache = new Map();
    }
  }

  return cache;
}

function clearCid10SynonymsCache() {
  cache = null;
}

/**
 * Termos oficiais equivalentes ao que foi digitado. Lista vazia quando o termo
 * não está no dicionário — o que é o caso comum e não é erro.
 *
 * Casamento exato pela chave normalizada, sem fuzzy: aproximação aqui casaria
 * "dor no peito" com "dor no pescoço" e mandaria a busca para a condição errada.
 */
function expandCid10Query(query) {
  const key = normalizeForMatch(query);

  if (!key) {
    return [];
  }

  return getCid10Synonyms().get(key) || [];
}

module.exports = {
  clearCid10SynonymsCache,
  expandCid10Query,
  getCid10Synonyms,
  loadCid10Synonyms,
  parseSynonyms,
};
