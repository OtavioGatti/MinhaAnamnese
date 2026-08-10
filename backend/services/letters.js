const OpenAI = require('openai');
const { getTextLimitError } = require('../utils/requestLimits');
const { sanitizeText } = require('../utils/textSanitization');
const { getSyncedOfficialPrompt } = require('./officialPrompts');
const { renderPromptTemplate } = require('../prompts/promptTemplate');
const {
  LETTER_CID_BLOCK_CLOSE,
  LETTER_CID_BLOCK_OPEN,
  LETTER_COMMON_GUARDRAILS,
  LETTER_OUTPUT_FORMAT_TOKEN,
  getLetterType,
  normalizeLetterTypeKey,
} = require('../config/letterTypes');

const MAX_FORMAT_TEMPLATE_LENGTH = 4000;
const CID10_FIELD_NAME = 'cid10';
// Formato da tabela CID-10: letra + 2 dígitos, com subdivisão opcional (J06.9).
const CID10_CODE_PATTERN = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/;
const MAX_CID10_CODES = 4;

function escapeForRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Cada marcador ocupa a própria linha e é consumido junto com ela, para que o
// espaçamento entre parágrafos sobreviva tanto ao manter quanto ao remover.
const CID_BLOCK_PATTERN = new RegExp(
  `^[ \\t]*${escapeForRegExp(LETTER_CID_BLOCK_OPEN)}[ \\t]*\\r?\\n([\\s\\S]*?)^[ \\t]*${escapeForRegExp(LETTER_CID_BLOCK_CLOSE)}[ \\t]*\\r?\\n?`,
  'gm',
);

// Rede de segurança para modelo escrito à mão com marcador fora de linha
// própria: o token é removido para não virar lixo visível no documento. O
// conteúdo fica, e quem garante a omissão é a regra condicional do tipo.
const CID_MARKER_LEFTOVER_PATTERN = new RegExp(
  `${escapeForRegExp(LETTER_CID_BLOCK_OPEN)}|${escapeForRegExp(LETTER_CID_BLOCK_CLOSE)}`,
  'g',
);

function normalizeShortText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
}

// Caixa alta e separadores uniformes: "j06.9, m54" -> "J06.9 M54".
function normalizeCid10(value) {
  return normalizeShortText(value).toUpperCase().replace(/[\s,;]+/g, ' ').trim();
}

function typeSupportsCid(type) {
  return Boolean(type?.fields?.some((field) => field.name === CID10_FIELD_NAME));
}

// Validação leve: garante que o campo carrega código(s) da tabela, não texto
// livre. O CID em si é decisão do médico — o servidor só confere o formato,
// porque é ele que dispara o termo de ciência do paciente.
function getCid10Error(value) {
  const normalized = normalizeCid10(value);

  if (!normalized) {
    return null;
  }

  const codes = normalized.split(' ');

  if (codes.length > MAX_CID10_CODES) {
    return `Informe no máximo ${MAX_CID10_CODES} códigos CID-10.`;
  }

  if (!codes.every((code) => CID10_CODE_PATTERN.test(code))) {
    return 'CID-10 inválido. Use o código da tabela (ex.: J06.9) ou deixe em branco.';
  }

  return null;
}

// Descarta chaves não declaradas pelo tipo: só os campos do registro chegam ao
// prompt, mesmo que o cliente envie outros (ex.: cid10 sobrando ao trocar de tipo).
function normalizeLetterFields(type, fields = {}) {
  const normalized = {};

  (type?.fields || []).forEach((field) => {
    normalized[field.name] = field.name === CID10_FIELD_NAME
      ? normalizeCid10(fields?.[field.name])
      : normalizeShortText(fields?.[field.name]);
  });

  return normalized;
}

// Mantém ou remove os blocos condicionais do formato antes de o prompt existir.
function applyConditionalFormatBlocks(format, { includeCid }) {
  return String(format || '')
    .replace(CID_BLOCK_PATTERN, (_match, inner) => (includeCid ? inner : ''))
    .replace(CID_MARKER_LEFTOVER_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Data de hoje é informação de sistema, não julgamento clínico: resolvida aqui
// e injetada via token, nunca deixada para a IA inferir do texto da anamnese.
function getTodayDateBR() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function normalizeFormatTemplate(value) {
  return sanitizeText(String(value || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_FORMAT_TEMPLATE_LENGTH);
}

// Valida o texto-base e os campos exigidos pelo tipo de carta.
function validateLetterInput({ letterType, texto, structuredText, fields = {} }) {
  const type = getLetterType(letterType);

  if (!type) {
    return 'Tipo de carta inválido.';
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'Preencha a historia clinica antes de gerar o documento.';
  }

  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return textLimitError.message;
  }

  const structuredTextLimitError = getTextLimitError(structuredText, 'resultado estruturado');

  if (structuredTextLimitError) {
    return structuredTextLimitError.message;
  }

  for (const field of type.fields) {
    const rawValue = fields?.[field.name];
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';

    if (field.required && !value) {
      return `Informe: ${field.label}.`;
    }

    if (value && field.maxLength && value.length > field.maxLength) {
      return `${field.label}: use ate ${field.maxLength} caracteres.`;
    }
  }

  if (typeSupportsCid(type)) {
    const cidError = getCid10Error(fields?.[CID10_FIELD_NAME]);

    if (cidError) {
      return cidError;
    }
  }

  return null;
}

// Monta o prompt de sistema: regras fixas (servidor) + objetivo do tipo +
// formato. O formato do usuario/modelo entra apenas no bloco de formato — nunca
// substitui as regras clinicas.
function buildLetterSystemPrompt(type, formatTemplate, promptOverride = null, fields = {}) {
  const includeCid = typeSupportsCid(type) && Boolean(normalizeCid10(fields?.[CID10_FIELD_NAME]));
  const rawFormat = normalizeFormatTemplate(formatTemplate) || type.defaultFormat;
  // Um formato que fosse só o bloco condicional ficaria vazio ao ser removido:
  // nesse caso o padrão do tipo assume, para não gerar documento sem esqueleto.
  const conditionalFormat = applyConditionalFormatBlocks(rawFormat, { includeCid })
    || applyConditionalFormatBlocks(type.defaultFormat, { includeCid });
  // {{data_emissao}} funciona em qualquer formato (padrão do tipo, modelo do
  // usuário ou oficial do Notion) — é o mesmo mecanismo do {{formato_saida}}.
  const format = renderPromptTemplate(conditionalFormat, { data_emissao: getTodayDateBR() });
  const conditionalRules = typeof type.buildConditionalRules === 'function'
    ? type.buildConditionalRules(fields)
    : '';

  if (promptOverride && promptOverride.includes(LETTER_OUTPUT_FORMAT_TOKEN)) {
    const rendered = renderPromptTemplate(promptOverride, { formato_saida: format });
    // Diferente do goalPrompt, as regras condicionais sobrevivem ao override:
    // elas registram consentimento, e o CMS controla só estilo e estrutura.
    return conditionalRules ? [rendered, '', conditionalRules].join('\n') : rendered;
  }

  return [
    LETTER_COMMON_GUARDRAILS,
    '',
    type.goalPrompt,
    ...(conditionalRules ? ['', conditionalRules] : []),
    '',
    'FORMATO DE SAÍDA (siga esta estrutura; remova blocos sem informação; preserve o texto fixo, como cabeçalho e assinatura):',
    format,
  ].join('\n');
}

function buildLetterUserMessage(type, { fields = {}, texto, structuredText }) {
  const lines = [];

  type.fields.forEach((field) => {
    const value = normalizeShortText(fields?.[field.name]);
    lines.push(`${field.label}: ${value || 'nao informado'}`);
  });

  const sanitizedText = sanitizeText(texto).trim();
  const sanitizedStructuredText = sanitizeText(structuredText || '').trim();

  lines.push('');
  lines.push('Anamnese original:');
  lines.push(sanitizedText);
  lines.push('');
  lines.push(sanitizedStructuredText ? 'Resultado estruturado disponivel:' : 'Resultado estruturado disponivel: nao informado');

  if (sanitizedStructuredText) {
    lines.push(sanitizedStructuredText);
  }

  return lines.join('\n');
}

async function generateLetter({ letterType, fields = {}, texto, structuredText = '', formatTemplate = '' }) {
  const validationError = validateLetterInput({ letterType, texto, structuredText, fields });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const type = getLetterType(letterType);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('Erro interno ao gerar o documento.');
    error.statusCode = 500;
    throw error;
  }

  const openai = new OpenAI({ apiKey });
  const normalizedFields = normalizeLetterFields(type, fields);
  const promptOverride = await getSyncedOfficialPrompt(type.promptSlug).catch(() => null);
  const systemPrompt = buildLetterSystemPrompt(
    type,
    formatTemplate,
    promptOverride?.promptBody || null,
    normalizedFields,
  );

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildLetterUserMessage(type, { fields: normalizedFields, texto, structuredText }) },
    ],
    temperature: 0.1,
    max_tokens: 900,
  });

  const letter = sanitizeText(response.choices?.[0]?.message?.content || '').trim();

  if (!letter) {
    const error = new Error('Erro interno ao gerar o documento.');
    error.statusCode = 500;
    throw error;
  }

  return {
    letter,
    letterType: normalizeLetterTypeKey(letterType),
  };
}

module.exports = {
  MAX_FORMAT_TEMPLATE_LENGTH,
  applyConditionalFormatBlocks,
  buildLetterSystemPrompt,
  generateLetter,
  getCid10Error,
  getTodayDateBR,
  normalizeCid10,
  normalizeFormatTemplate,
  normalizeLetterFields,
  validateLetterInput,
};
