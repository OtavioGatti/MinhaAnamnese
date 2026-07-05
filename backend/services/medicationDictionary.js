// Dicionário canônico de medicamentos (seed da Prefeitura de Assis + outras
// fontes). Formato CSV com colunas:
//   nome, principio_ativo, apresentacao, fonte, status, unidade, atualizado_em
//
// status é normalizado para 'disponivel' | 'em_falta'. O caminho do arquivo
// pode ser sobrescrito por MEDICATION_DICTIONARY_PATH (para carregar a lista
// completa depois, sem mexer no código).

const fs = require('fs');
const path = require('path');
const { normalizeForMatch } = require('../utils/stringSimilarity');

const DEFAULT_DICTIONARY_PATH = path.join(__dirname, '..', 'data', 'medicamentos_assis.seed.csv');
const EXPECTED_COLUMNS = [
  'nome',
  'principio_ativo',
  'apresentacao',
  'fonte',
  'status',
  'unidade',
  'atualizado_em',
];

let cache = null;

// Parser CSV tolerante: aspas duplas, vírgulas dentro de campo entre aspas,
// e "" como aspa escapada. Suficiente para planilhas exportadas simples.
function parseCsvRows(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ''));
}

function normalizeStatus(value) {
  const normalized = normalizeForMatch(value);

  if (!normalized) {
    return 'disponivel';
  }

  if (normalized.includes('falta') || normalized.includes('indispon') || normalized.includes('sem estoque')) {
    return 'em_falta';
  }

  return 'disponivel';
}

function parseMedicationCsv(text) {
  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((cell) => normalizeForMatch(cell).replace(/\s+/g, '_'));
  const columnIndex = {};
  EXPECTED_COLUMNS.forEach((column) => {
    columnIndex[column] = header.indexOf(column);
  });

  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const get = (column) => {
      const index = columnIndex[column];
      return index >= 0 && index < cells.length ? String(cells[index]).trim() : '';
    };

    const nome = get('nome');
    const principioAtivo = get('principio_ativo');

    if (!nome && !principioAtivo) {
      continue;
    }

    records.push({
      nome,
      principio_ativo: principioAtivo,
      apresentacao: get('apresentacao'),
      fonte: get('fonte'),
      status: normalizeStatus(get('status')),
      unidade: get('unidade'),
      atualizado_em: get('atualizado_em'),
      match: {
        nome: normalizeForMatch(nome),
        principio_ativo: normalizeForMatch(principioAtivo),
      },
    });
  }

  return records;
}

function resolveDictionaryPath() {
  return process.env.MEDICATION_DICTIONARY_PATH || DEFAULT_DICTIONARY_PATH;
}

function loadMedicationDictionary(filePath) {
  const resolved = filePath || resolveDictionaryPath();
  const text = fs.readFileSync(resolved, 'utf8');
  return parseMedicationCsv(text);
}

// Carrega uma vez e mantém em memória (invalidável por clearMedicationDictionaryCache).
function getMedicationDictionary() {
  if (!cache) {
    cache = loadMedicationDictionary();
  }

  return cache;
}

function clearMedicationDictionaryCache() {
  cache = null;
}

module.exports = {
  DEFAULT_DICTIONARY_PATH,
  EXPECTED_COLUMNS,
  parseMedicationCsv,
  parseCsvRows,
  normalizeStatus,
  loadMedicationDictionary,
  getMedicationDictionary,
  clearMedicationDictionaryCache,
};
