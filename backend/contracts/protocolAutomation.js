// Contrato da automação de protocolos de prescrição.
//
// Responsável por: (1) montar o JSON Schema strict para Structured Outputs a
// partir das opções VIVAS do Notion (nunca hardcodar enums); (2) normalizar a
// saída do modelo; (3) aplicar a TRAVA de revisão humana que é a garantia de
// segurança deste pipeline — nenhum fluxo automático pode marcar um protocolo
// como pronto/revisado.
//
// Espelha o formato de contracts/diagnosticHypotheses.js.

const { stripAccents } = require('../utils/stringSimilarity');

// Valores forçados em TODA saída automática (geração e correção), independente
// do que o modelo devolver ou do que já existia na página.
const LOCKED_STATUS_REVISAO = 'Revisão clínica pendente';
const STATUS_AUTOMACAO_GERADO = 'gerado — aguardando revisão';
const STATUS_AUTOMACAO_CORRIGIDO = 'corrigido — aguardando revisão';
const STATUS_AUTOMACAO_ERRO = 'erro na automação';
const LOCKED_REVISOR = '';
const PRONTO_PARA_SUPABASE = false; // boolean nativo — NUNCA string.

// Campos multi_select/select restritos às opções existentes no Notion.
const MULTI_SELECT_ENUM_FIELDS = ['especialidade', 'contexto', 'nivel_risco'];
const SELECT_ENUM_FIELDS = ['tipo_protocolo'];

// Campos de texto curto (uma linha).
const SHORT_TEXT_FIELDS = [
  'titulo',
  'slug',
  'subcondicao',
  'fonte',
  'fonte_pagina',
  'fonte_secao',
  'cid10_principal',
  'cid10_opcoes',
];

// Campos de texto longo (clínicos e textos copiáveis).
const LONG_TEXT_FIELDS = [
  'resumo_clinico',
  'quando_usar',
  'quando_nao_usar',
  'conduta_procedimento',
  'prescricao_medicamentos',
  'orientacoes_paciente',
  'sinais_alerta',
  'criterios_encaminhamento',
  'observacoes_clinicas',
  'texto_copiavel_conduta',
  'texto_copiavel_prescricao',
  'texto_copiavel_orientacoes',
  'texto_copiavel_completo',
  'observacao_editorial',
];

// Campos que o MODELO gera (a trava injeta o resto — status_revisao,
// pronto_para_supabase, revisor, status_automacao — que ficam fora do schema).
const MODEL_GENERATED_FIELDS = [
  ...SHORT_TEXT_FIELDS,
  ...SELECT_ENUM_FIELDS,
  ...MULTI_SELECT_ENUM_FIELDS,
  ...LONG_TEXT_FIELDS,
  'tags',
];

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

// Separador canônico entre "nome dose" e a instrução na prescrição copiável.
// Os protocolos existentes usam exatamente 40 hifens.
const PRESCRIPTION_SEPARATOR = '-'.repeat(40);

// Canonicaliza a prescrição copiável para o padrão VISUAL dos protocolos
// existentes: separador de 40 hifens, instrução como parágrafo após o
// separador, e linha em branco antes de cada item [n] e de cada -Opção.
function normalizeCopyPrescription(value) {
  return normalizeLongText(value)
    // separador canônico de 40 hifens
    .replace(/[ \t]*-{3,}[—–-]*/g, ` ${PRESCRIPTION_SEPARATOR}`)
    // instrução na mesma linha após o separador vira parágrafo
    .replace(/(-{40})[ \t]+(?=\S)/g, '$1\n\n')
    // remove linhas que são só separador (divisores soltos entre opções)
    .replace(/^[ \t]*-{3,}[ \t]*$/gm, '')
    // linha em branco antes de cada item [n] e de cada cabeçalho -Opção
    .replace(/\n(?=\[\d{1,2}\])/g, '\n\n')
    .replace(/\n(?=-Opção\b)/gi, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Monta texto_copiavel_completo no formato canônico dos protocolos existentes:
//   -CONDUTA: <bullets> / -PRESCRIÇÃO: <opções> / -ORIENTAÇÕES: <bullets>
function buildCanonicalCompleteText({ conduta, prescricao, orientacoes } = {}) {
  const parts = [];

  if (conduta) {
    parts.push(`-CONDUTA:\n${conduta}`);
  }

  if (prescricao) {
    parts.push(`-PRESCRIÇÃO:\n\n${prescricao}`);
  }

  if (orientacoes) {
    parts.push(`-ORIENTAÇÕES:\n${orientacoes}`);
  }

  return parts.join('\n\n').trim();
}

function uniqueStrings(value, allowedSet) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const out = [];

  for (const item of value) {
    const text = normalizeText(item);

    if (!text) {
      continue;
    }

    // Se há lista de opções, descarta o que não existe no Notion.
    if (allowedSet && !allowedSet.has(text)) {
      continue;
    }

    const key = text.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(text);
  }

  return out;
}

// Propriedade de array restrita a um enum de opções (multi_select). Se não há
// opções conhecidas ainda, cai para array de strings livre (schema válido).
function multiSelectProperty(options) {
  const items = Array.isArray(options) && options.length > 0
    ? { type: 'string', enum: options }
    : { type: 'string' };

  return {
    type: 'array',
    items,
  };
}

// Propriedade de string restrita a um enum (select). Sem opções, string livre.
function selectProperty(options) {
  if (Array.isArray(options) && options.length > 0) {
    return { type: 'string', enum: options };
  }

  return { type: 'string' };
}

/**
 * Monta o JSON Schema strict para o Structured Output, com os enums vindos das
 * opções vivas do Notion. `options` = { especialidade, contexto, nivel_risco,
 * tipo_protocolo } onde cada valor é um array de nomes de opção.
 */
function buildProtocolSchema(options = {}) {
  const properties = {};

  for (const field of SHORT_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }

  for (const field of LONG_TEXT_FIELDS) {
    properties[field] = { type: 'string' };
  }

  for (const field of MULTI_SELECT_ENUM_FIELDS) {
    properties[field] = multiSelectProperty(options[field]);
  }

  for (const field of SELECT_ENUM_FIELDS) {
    properties[field] = selectProperty(options[field]);
  }

  properties.tags = { type: 'array', items: { type: 'string' } };

  return {
    type: 'object',
    additionalProperties: false,
    // OpenAI strict exige TODAS as chaves em `required`.
    required: [...MODEL_GENERATED_FIELDS],
    properties,
  };
}

/**
 * Normaliza o objeto devolvido pelo modelo: limpa textos, filtra os enums
 * pelas opções válidas e gera slug a partir do título quando ausente.
 * NÃO aplica a trava — use applyAutomationLock em seguida.
 */
function normalizeProtocol(raw = {}, options = {}) {
  const out = {};

  for (const field of SHORT_TEXT_FIELDS) {
    out[field] = normalizeText(raw[field]);
  }

  for (const field of LONG_TEXT_FIELDS) {
    out[field] = normalizeLongText(raw[field]);
  }

  for (const field of MULTI_SELECT_ENUM_FIELDS) {
    const allowed = Array.isArray(options[field]) && options[field].length > 0
      ? new Set(options[field])
      : null;
    out[field] = uniqueStrings(raw[field], allowed);
  }

  for (const field of SELECT_ENUM_FIELDS) {
    const value = normalizeText(raw[field]);
    const allowed = Array.isArray(options[field]) && options[field].length > 0
      ? new Set(options[field])
      : null;
    out[field] = !value || (allowed && !allowed.has(value)) ? '' : value;
  }

  out.tags = uniqueStrings(raw.tags, null);

  if (!out.slug) {
    out.slug = normalizeSlug(out.titulo);
  } else {
    out.slug = normalizeSlug(out.slug);
  }

  // Formatação canônica dos textos copiáveis (padrão visual do site): separador
  // de 40 hifens na prescrição e completo montado deterministicamente.
  out.texto_copiavel_prescricao = normalizeCopyPrescription(out.texto_copiavel_prescricao);
  out.texto_copiavel_completo = buildCanonicalCompleteText({
    conduta: out.texto_copiavel_conduta,
    prescricao: out.texto_copiavel_prescricao,
    orientacoes: out.texto_copiavel_orientacoes,
  });

  return out;
}

/**
 * TRAVA DE REVISÃO HUMANA. Sobrescreve incondicionalmente os campos de status
 * para os valores seguros. Qualquer tentativa (do modelo ou de dados antigos)
 * de marcar pronto_para_supabase=true ou status revisado é anulada aqui.
 * Esta é a função que os testes protegem.
 */
function applyAutomationLock(protocol = {}, { statusAutomacao = STATUS_AUTOMACAO_GERADO } = {}) {
  return {
    ...protocol,
    status_revisao: LOCKED_STATUS_REVISAO,
    pronto_para_supabase: PRONTO_PARA_SUPABASE,
    revisor: LOCKED_REVISOR,
    status_automacao: statusAutomacao,
  };
}

/** Normaliza e aplica a trava em um passo — saída pronta para preview/escrita. */
function finalizeAutomationProtocol(raw = {}, options = {}, lockOptions = {}) {
  return applyAutomationLock(normalizeProtocol(raw, options), lockOptions);
}

module.exports = {
  LOCKED_STATUS_REVISAO,
  STATUS_AUTOMACAO_GERADO,
  STATUS_AUTOMACAO_CORRIGIDO,
  STATUS_AUTOMACAO_ERRO,
  LOCKED_REVISOR,
  PRONTO_PARA_SUPABASE,
  MULTI_SELECT_ENUM_FIELDS,
  SELECT_ENUM_FIELDS,
  SHORT_TEXT_FIELDS,
  LONG_TEXT_FIELDS,
  MODEL_GENERATED_FIELDS,
  buildProtocolSchema,
  normalizeProtocol,
  applyAutomationLock,
  finalizeAutomationProtocol,
  normalizeSlug,
  normalizeCopyPrescription,
  buildCanonicalCompleteText,
  PRESCRIPTION_SEPARATOR,
};
