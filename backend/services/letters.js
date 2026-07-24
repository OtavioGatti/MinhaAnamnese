const OpenAI = require('openai');
const { getTextLimitError } = require('../utils/requestLimits');
const { sanitizeText } = require('../utils/textSanitization');
const { getSyncedOfficialPrompt } = require('./officialPrompts');
const { renderPromptTemplate } = require('../prompts/promptTemplate');
const {
  LETTER_COMMON_GUARDRAILS,
  LETTER_OUTPUT_FORMAT_TOKEN,
  getLetterType,
  normalizeLetterTypeKey,
} = require('../config/letterTypes');

const MAX_FORMAT_TEMPLATE_LENGTH = 4000;

function normalizeShortText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
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

  return null;
}

// Monta o prompt de sistema: regras fixas (servidor) + objetivo do tipo +
// formato. O formato do usuario/modelo entra apenas no bloco de formato — nunca
// substitui as regras clinicas.
function buildLetterSystemPrompt(type, formatTemplate, promptOverride = null) {
  const format = normalizeFormatTemplate(formatTemplate) || type.defaultFormat;

  if (promptOverride && promptOverride.includes(LETTER_OUTPUT_FORMAT_TOKEN)) {
    return renderPromptTemplate(promptOverride, { formato_saida: format });
  }

  return [
    LETTER_COMMON_GUARDRAILS,
    '',
    type.goalPrompt,
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
  const promptOverride = await getSyncedOfficialPrompt(type.promptSlug).catch(() => null);
  const systemPrompt = buildLetterSystemPrompt(type, formatTemplate, promptOverride?.promptBody || null);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildLetterUserMessage(type, { fields, texto, structuredText }) },
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
  buildLetterSystemPrompt,
  generateLetter,
  normalizeFormatTemplate,
  validateLetterInput,
};
