const OpenAI = require('openai');
const { getTextLimitError } = require('../utils/requestLimits');
const { sanitizeText } = require('../utils/textSanitization');
const { getSyncedOfficialPrompt } = require('./officialPrompts');

const MAX_SPECIALTY_LENGTH = 80;
const MAX_REASON_LENGTH = 240;

function normalizeShortText(value) {
  return sanitizeText(String(value || '')).replace(/\s+/g, ' ').trim();
}

function validateReferralLetterInput(payload) {
  const { texto, structuredText, specialty, reason } = payload || {};

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return 'Preencha a historia clinica antes de gerar a carta.';
  }

  const textLimitError = getTextLimitError(texto, 'texto da anamnese');

  if (textLimitError) {
    return textLimitError.message;
  }

  const structuredTextLimitError = getTextLimitError(structuredText, 'resultado estruturado');

  if (structuredTextLimitError) {
    return structuredTextLimitError.message;
  }

  if (!specialty || typeof specialty !== 'string' || !specialty.trim()) {
    return 'Informe a especialidade de destino.';
  }

  if (specialty.trim().length > MAX_SPECIALTY_LENGTH) {
    return `Informe a especialidade com ate ${MAX_SPECIALTY_LENGTH} caracteres.`;
  }

  if (reason && (typeof reason !== 'string' || reason.trim().length > MAX_REASON_LENGTH)) {
    return `Informe o motivo com ate ${MAX_REASON_LENGTH} caracteres.`;
  }

  return null;
}

function buildReferralLetterPrompt(promptTemplate = null) {
  if (promptTemplate) {
    return promptTemplate;
  }

  return `Voce e um assistente editorial medico para redigir cartas de encaminhamento clinicas, objetivas e copiaveis.

Objetivo:
Criar uma carta de encaminhamento para a especialidade informada, usando somente informacoes presentes na anamnese e no resultado estruturado.

Regras obrigatorias:
- Nao invente sintomas, exame fisico, sinais vitais, diagnosticos, exames, medicamentos, condutas ou antecedentes.
- Se o dado nao estiver informado, omita o dado. Nao crie placeholders.
- Filtre o conteudo: inclua apenas dados clinicos relevantes para a especialidade de destino e para o motivo do encaminhamento.
- Inclua comorbidades, medicamentos, alergias, gestacao ou anticoagulantes somente quando forem relevantes para a especialidade, a queixa ou a seguranca do encaminhamento.
- Se houver sinal de alerta relacionado a especialidade, destaque de forma objetiva.
- Nao escreva orientacoes terapeuticas novas nem prescricao.
- Nao use markdown, tabelas ou listas longas.
- Nao use frases promocionais ou academicas.
- Use linguagem clinica brasileira, formal e direta.
- A carta deve ficar pronta para copiar e colar.

Formato de saida:
CARTA DE ENCAMINHAMENTO
Ao colega da [especialidade],

Encaminho paciente para avaliacao em [especialidade] por [motivo clinico principal].

Resumo clinico: [texto corrido com dados relevantes].

Achados relevantes: [somente se houver exame fisico, sinais vitais, exames ou dados objetivos relevantes].

Justificativa do encaminhamento: [por que a avaliacao especializada e indicada].

Atenciosamente,

Se algum bloco nao tiver informacao suficiente, remova o bloco inteiro.`;
}

async function generateReferralLetter({ texto, structuredText = '', specialty, reason = '' }) {
  const validationError = validateReferralLetterInput({
    texto,
    structuredText,
    specialty,
    reason,
  });

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('Erro interno ao gerar a carta.');
    error.statusCode = 500;
    throw error;
  }

  const openai = new OpenAI({ apiKey });
  const sanitizedText = sanitizeText(texto).trim();
  const sanitizedStructuredText = sanitizeText(structuredText).trim();
  const sanitizedSpecialty = normalizeShortText(specialty);
  const sanitizedReason = normalizeShortText(reason);
  const syncedPrompt = await getSyncedOfficialPrompt('referral_letter_system').catch(() => null);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildReferralLetterPrompt(syncedPrompt?.promptBody || null) },
      {
        role: 'user',
        content: [
          `Especialidade de destino: ${sanitizedSpecialty}`,
          sanitizedReason ? `Motivo informado pelo usuario: ${sanitizedReason}` : 'Motivo informado pelo usuario: nao informado',
          '',
          'Anamnese original:',
          sanitizedText,
          '',
          sanitizedStructuredText ? 'Resultado estruturado disponivel:' : 'Resultado estruturado disponivel: nao informado',
          sanitizedStructuredText,
        ].join('\n'),
      },
    ],
    temperature: 0.1,
    max_tokens: 900,
  });

  const letter = sanitizeText(response.choices?.[0]?.message?.content || '').trim();

  if (!letter) {
    const error = new Error('Erro interno ao gerar a carta.');
    error.statusCode = 500;
    throw error;
  }

  return {
    letter,
  };
}

module.exports = {
  generateReferralLetter,
  validateReferralLetterInput,
};
