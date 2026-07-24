// Contrato da automação de bulário (medicamentos da base Notion "Clínico
// Revisado"). Espelha contracts/protocolAutomation.js:
// (1) monta o JSON Schema strict para Structured Outputs; (2) normaliza a saída;
// (3) aplica a TRAVA de revisão humana — a IA nunca marca a bula como revisada.
//
// Diferença central em relação a protocolos: aqui as chaves do modelo
// (snake_case) NÃO são os nomes das propriedades do Notion (rótulos em pt-BR),
// então mantemos um mapa FIELD_TO_NOTION explícito.

const { stripAccents } = require('../utils/stringSimilarity');

// Estado que a trava injeta em toda saída automática (a IA nunca define isto).
const STATUS_AUTOMACAO_GERADO = 'gerado — aguardando revisão';
const STATUS_AUTOMACAO_CORRIGIDO = 'corrigido — aguardando revisão';
const STATUS_AUTOMACAO_ERRO = 'erro na automação';

// Estados de "pendente" que travam a publicação: o sync do bulário PULA páginas
// nesses estados para que conteúdo de IA não vá ao ar sem revisão humana.
const PENDING_REVIEW_STATUSES = new Set([
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
]);

// Chave do modelo (snake_case) -> nome da propriedade no Notion "Clínico Revisado".
const FIELD_TO_NOTION = {
  active_ingredient: 'Princípio Ativo',
  slug: 'Slug',
  class_category: 'Classe / Categoria',
  contraindications: 'Contraindicações',
  adult_dosage: 'Posologia Adulto',
  pediatric_dosage: 'Posologia Pediátrica',
  warnings: 'Advertências',
  interactions: 'Interações',
  interaction_pairs: 'Interações Estruturadas',
  presentations: 'Apresentações / Nomes Comerciais',
  commercial_names_openai: 'Nomes Comerciais OpenAI',
  pregnancy_risk: 'Risco Gestacional',
  summary_text: 'Texto Resumo',
  search_tags: 'Tags Busca',
  // controle (não gerados pelo modelo):
  automation_status: 'Status Automação',
  correction_instruction: 'Instrução de correção',
};

const NOTION_TO_FIELD = Object.fromEntries(
  Object.entries(FIELD_TO_NOTION).map(([field, notionName]) => [notionName, field]),
);

// Risco gestacional só aceita o conjunto canônico (o sync descarta o resto).
const CANONICAL_PREGNANCY_RISK = ['A', 'B', 'C', 'D', 'X', 'Indefinido', 'Não se aplica'];

const SHORT_TEXT_FIELDS = ['active_ingredient', 'class_category', 'search_tags'];
const LONG_TEXT_FIELDS = [
  'contraindications',
  'adult_dosage',
  'pediatric_dosage',
  'warnings',
  'interactions',
  'presentations',
  'commercial_names_openai',
  'summary_text',
];
const SELECT_ENUM_FIELDS = ['pregnancy_risk'];
// Campo estruturado (array de objetos), serializado como JSON no Notion.
const ARRAY_FIELDS = ['interaction_pairs'];

const INTERACTION_SEVERITIES = ['danger', 'warning', 'info'];

// Campos que o MODELO gera. slug é derivado (não pedido ao modelo); os campos de
// controle ficam por conta da trava/humano.
const MODEL_GENERATED_FIELDS = [
  ...SHORT_TEXT_FIELDS,
  ...LONG_TEXT_FIELDS,
  ...SELECT_ENUM_FIELDS,
  ...ARRAY_FIELDS,
];

// Campos considerados no modo auto-completar de UMA página marcada "a corrigir"
// (o humano pediu explicitamente): inclui interaction_pairs.
const COMPLETABLE_FIELDS = [
  'class_category',
  'contraindications',
  'adult_dosage',
  'pediatric_dosage',
  'warnings',
  'interactions',
  'interaction_pairs',
  'presentations',
  'commercial_names_openai',
  'pregnancy_risk',
  'summary_text',
];

// Campos considerados na FILA EM LOTE (queue-incomplete): NÃO inclui
// interaction_pairs — quase toda bula está sem, enfileiraria o bulário inteiro.
const QUEUEABLE_FIELDS = COMPLETABLE_FIELDS.filter((field) => field !== 'interaction_pairs');

function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSlug(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function selectProperty(options) {
  if (Array.isArray(options) && options.length > 0) {
    return { type: 'string', enum: options };
  }
  return { type: 'string' };
}

// Monta o JSON Schema strict. `options` = { pregnancy_risk: [...] } com as opções
// vivas do Notion já intersectadas com o conjunto canônico.
function buildClinicalDrugSchema(options = {}) {
  const properties = {};

  for (const field of SHORT_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }
  for (const field of LONG_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }
  for (const field of SELECT_ENUM_FIELDS) {
    properties[field] = selectProperty(options[field]);
  }

  // Interações estruturadas: pares (com o outro fármaco/classe). target_slug e
  // needs_review são derivados no código (não pedidos ao modelo).
  properties.interaction_pairs = {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['target', 'severity', 'mechanism', 'message'],
      properties: {
        target: { type: 'string' },
        severity: { type: 'string', enum: INTERACTION_SEVERITIES },
        mechanism: { type: 'string' },
        message: { type: 'string' },
      },
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    required: [...MODEL_GENERATED_FIELDS],
    properties,
  };
}

// Interseção das opções vivas do Notion com o conjunto canônico aceito no site.
function resolvePregnancyRiskOptions(liveOptions) {
  const live = new Set(Array.isArray(liveOptions) ? liveOptions : []);
  const allowed = CANONICAL_PREGNANCY_RISK.filter((value) => live.has(value));
  return allowed.length > 0 ? allowed : CANONICAL_PREGNANCY_RISK;
}

// Normaliza pares de interação. Toda saída da IA entra como needs_review=true e
// confidence baixa — ficam DORMENTES (o frontend só dispara alerta de pares já
// revisados, com needs_review=false). target_slug é derivado do nome do alvo.
function normalizeInteractionPairs(raw) {
  const pairs = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];

  for (const pair of pairs) {
    const target = normalizeText(pair?.target);
    if (!target) {
      continue;
    }

    const targetSlug = normalizeSlug(target);
    const key = targetSlug || target.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    out.push({
      target,
      target_slug: targetSlug,
      severity: INTERACTION_SEVERITIES.includes(pair?.severity) ? pair.severity : 'warning',
      mechanism: normalizeText(pair?.mechanism),
      message: normalizeText(pair?.message),
      source: 'ai',
      confidence: 'low',
      needs_review: true,
    });

    if (out.length >= 40) {
      break;
    }
  }

  return out;
}

// Aceita array (do modelo) ou string JSON (lida da página na correção).
function coerceInteractionPairs(value) {
  if (Array.isArray(value)) {
    return value;
  }

  const text = String(value == null ? '' : value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

// Normaliza a saída do modelo. NÃO aplica a trava.
function normalizeClinicalDrug(raw = {}, options = {}) {
  const out = {};

  for (const field of SHORT_TEXT_FIELDS) {
    out[field] = normalizeText(raw[field]);
  }
  for (const field of LONG_TEXT_FIELDS) {
    out[field] = normalizeLongText(raw[field]);
  }

  const allowedRisk = new Set(
    Array.isArray(options.pregnancy_risk) && options.pregnancy_risk.length > 0
      ? options.pregnancy_risk
      : CANONICAL_PREGNANCY_RISK,
  );
  const risk = normalizeText(raw.pregnancy_risk);
  out.pregnancy_risk = allowedRisk.has(risk) ? risk : '';

  out.interaction_pairs = normalizeInteractionPairs(coerceInteractionPairs(raw.interaction_pairs));

  out.slug = normalizeSlug(raw.slug || out.active_ingredient);

  return out;
}

// TRAVA DE REVISÃO HUMANA. Injeta o status de automação (pendente de revisão).
// O sync do bulário respeita esse status e não publica a página até um humano
// revisar e sair do estado pendente.
function applyClinicalDrugLock(drug = {}, { statusAutomacao = STATUS_AUTOMACAO_GERADO } = {}) {
  return {
    ...drug,
    automation_status: statusAutomacao,
  };
}

function finalizeClinicalDrug(raw = {}, options = {}, lockOptions = {}) {
  return applyClinicalDrugLock(normalizeClinicalDrug(raw, options), lockOptions);
}

// Um campo de conteúdo está "vazio"? interaction_pairs é considerado vazio
// quando o array (ou o JSON armazenado) não tem nenhuma entrada.
function isFieldEmpty(field, value) {
  if (field === 'interaction_pairs') {
    return coerceInteractionPairs(value).length === 0;
  }
  return String(value == null ? '' : value).trim() === '';
}

module.exports = {
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  PENDING_REVIEW_STATUSES,
  FIELD_TO_NOTION,
  NOTION_TO_FIELD,
  CANONICAL_PREGNANCY_RISK,
  SHORT_TEXT_FIELDS,
  LONG_TEXT_FIELDS,
  SELECT_ENUM_FIELDS,
  MODEL_GENERATED_FIELDS,
  COMPLETABLE_FIELDS,
  QUEUEABLE_FIELDS,
  isFieldEmpty,
  buildClinicalDrugSchema,
  resolvePregnancyRiskOptions,
  normalizeClinicalDrug,
  applyClinicalDrugLock,
  finalizeClinicalDrug,
  normalizeSlug,
};
