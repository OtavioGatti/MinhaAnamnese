// Autorização das rotas da automação de exames. Segredo dedicado
// EXAM_AUTOMATION_SECRET com fallback para PROTOCOL_AUTOMATION_SECRET e
// ADMIN_SYNC_SECRET, reusando o parser de bearer token de adminAuth.js.

const { getBearerToken } = require('./adminAuth');

function getExpectedExamSecret() {
  return process.env.EXAM_AUTOMATION_SECRET ||
    process.env.PROTOCOL_AUTOMATION_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    '';
}

function isExamSecretConfigured() {
  return Boolean(getExpectedExamSecret());
}

function isAuthorizedExamRequest(req) {
  const expected = getExpectedExamSecret();
  const provided = getBearerToken(req);

  return Boolean(expected && provided && provided === expected);
}

module.exports = {
  getExpectedExamSecret,
  isAuthorizedExamRequest,
  isExamSecretConfigured,
};
