// Pareamento de nome clínico contra um catálogo curado, por igualdade
// normalizada — nunca por substring, que casaria "Pneumonia" com qualquer
// pneumonia e traria o conteúdo de outra condição.
//
// Nasceu dentro de prescriptionGuides.js (hipótese -> guia/CID) e foi extraído
// aqui quando o mesmo pareamento passou a valer para outros catálogos revisados
// (manobras de exame físico, exames complementares). A regra é a mesma em
// todos: a IA nomeia, o catálogo responde — e um nome que não casa não vira
// conteúdo clínico, vira backlog editorial.

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeMatchKey(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Catálogos listam sinônimos da mesma entrada separados por barra ("Sinusite
// Aguda / Rinossinusite Aguda Bacteriana"). Cada trecho é um nome válido, então
// vira uma chave própria — senão o nome curto nunca casa com o título composto.
const ALIAS_SEPARATORS = /\s*[/|;]\s*/;

// O prompt pede a sigla consagrada junto do nome ("Pneumonia Adquirida na
// Comunidade (PAC)"), enquanto o catálogo costuma ter só o nome expandido.
const TRAILING_ACRONYM = /\s*\(([^)]+)\)\s*$/;

// Todas as grafias sob as quais uma entrada do catálogo pode ser encontrada.
function buildAliasKeys(rawNames) {
  const keys = new Set();

  for (const rawName of rawNames || []) {
    const name = String(rawName || '');

    if (!name.trim()) {
      continue;
    }

    for (const part of [name, ...name.split(ALIAS_SEPARATORS)]) {
      const key = normalizeMatchKey(part);

      if (key) {
        keys.add(key);
      }
    }
  }

  return keys;
}

// Chaves do termo buscado em ordem de prioridade: nome completo primeiro, sigla
// isolada por último (mais genérica, poderia casar com outra entrada).
function buildQueryMatchKeys(query) {
  const name = String(query || '').trim();
  const keys = [];
  const addKey = (value) => {
    const key = normalizeMatchKey(value);

    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  };

  addKey(name);

  const acronymMatch = name.match(TRAILING_ACRONYM);

  if (acronymMatch) {
    addKey(name.replace(TRAILING_ACRONYM, ''));
    addKey(acronymMatch[1]);
  }

  return keys;
}

// `getAliasKeys` recebe um item do catálogo e devolve o Set de chaves dele:
// cada catálogo guarda o nome em campos diferentes.
function findExactAliasMatch(query, items, getAliasKeys) {
  const queryKeys = buildQueryMatchKeys(query);

  if (queryKeys.length === 0 || !Array.isArray(items)) {
    return null;
  }

  const candidates = items.map((item) => ({ item, aliasKeys: getAliasKeys(item) }));

  for (const key of queryKeys) {
    const found = candidates.find((candidate) => candidate.aliasKeys.has(key));

    if (found) {
      return found.item;
    }
  }

  return null;
}

// A busca precisa do nome sem a sigla final: "(PAC)" não aparece no título
// cadastrado e zeraria o resultado antes do pareamento sequer acontecer.
function buildCatalogSearchName(query) {
  const normalizedName = String(query || '').replace(/\s+/g, ' ').trim();

  return normalizedName.replace(TRAILING_ACRONYM, '').replace(/\s+/g, ' ').trim() || normalizedName;
}

module.exports = {
  ALIAS_SEPARATORS,
  TRAILING_ACRONYM,
  buildAliasKeys,
  buildCatalogSearchName,
  buildQueryMatchKeys,
  findExactAliasMatch,
  normalizeMatchKey,
  stripAccents,
};
