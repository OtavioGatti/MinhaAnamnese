const DEFAULT_MAX_ANAMNESIS_TEXT_LENGTH = 20000;

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const MAX_ANAMNESIS_TEXT_LENGTH = parsePositiveInteger(
  process.env.MAX_ANAMNESIS_TEXT_LENGTH,
  DEFAULT_MAX_ANAMNESIS_TEXT_LENGTH,
);

function getTextLimitError(text, label = 'texto') {
  if (typeof text !== 'string') {
    return null;
  }

  if (text.length <= MAX_ANAMNESIS_TEXT_LENGTH) {
    return null;
  }

  return {
    statusCode: 413,
    message: `O ${label} está muito longo. Envie até ${MAX_ANAMNESIS_TEXT_LENGTH} caracteres por vez.`,
  };
}

function sendTextLimitError(res, error) {
  return res.status(error.statusCode || 413).json({
    success: false,
    error: error.message,
  });
}

module.exports = {
  MAX_ANAMNESIS_TEXT_LENGTH,
  getTextLimitError,
  sendTextLimitError,
};
