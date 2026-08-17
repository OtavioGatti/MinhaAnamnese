// Autorização das rotas da automação de ferramentas clínicas. Segredo dedicado
// CLINICAL_TOOL_AUTOMATION_SECRET com fallback para PROTOCOL_AUTOMATION_SECRET
// e ADMIN_SYNC_SECRET, reusando o parser de bearer token de adminAuth.js.

const { getBearerToken } = require('./adminAuth');

function getExpectedClinicalToolSecret() {
  return process.env.CLINICAL_TOOL_AUTOMATION_SECRET ||
    process.env.PROTOCOL_AUTOMATION_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    '';
}

function isClinicalToolSecretConfigured() {
  return Boolean(getExpectedClinicalToolSecret());
}

function isAuthorizedClinicalToolRequest(req) {
  const expected = getExpectedClinicalToolSecret();
  const provided = getBearerToken(req);

  return Boolean(expected && provided && provided === expected);
}

module.exports = {
  getExpectedClinicalToolSecret,
  isAuthorizedClinicalToolRequest,
  isClinicalToolSecretConfigured,
};
