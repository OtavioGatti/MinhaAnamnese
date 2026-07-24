// Compat: o encaminhamento agora é apenas o tipo 'encaminhamento' do gerador
// genérico de cartas (services/letters.js). Este módulo mantém a assinatura
// antiga usada pelo handler legado /api/referral-letter.
const { generateLetter, validateLetterInput } = require('./letters');

function validateReferralLetterInput({ texto, structuredText, specialty, reason }) {
  return validateLetterInput({
    letterType: 'encaminhamento',
    texto,
    structuredText,
    fields: { specialty, reason },
  });
}

async function generateReferralLetter({ texto, structuredText = '', specialty, reason = '' }) {
  const { letter } = await generateLetter({
    letterType: 'encaminhamento',
    fields: { specialty, reason },
    texto,
    structuredText,
  });

  return { letter };
}

module.exports = {
  generateReferralLetter,
  validateReferralLetterInput,
};
