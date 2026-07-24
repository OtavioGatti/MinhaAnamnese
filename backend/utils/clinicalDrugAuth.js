// Autorização das rotas da automação de bulário. Segredo dedicado
// CLINICAL_DRUG_AUTOMATION_SECRET com fallback para PROTOCOL_AUTOMATION_SECRET e
// ADMIN_SYNC_SECRET, reusando o parser de bearer token de adminAuth.js.

const { getBearerToken } = require('./adminAuth');

function getExpectedClinicalDrugSecret() {
  return process.env.CLINICAL_DRUG_AUTOMATION_SECRET ||
    process.env.PROTOCOL_AUTOMATION_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    '';
}

function isClinicalDrugSecretConfigured() {
  return Boolean(getExpectedClinicalDrugSecret());
}

function isAuthorizedClinicalDrugRequest(req) {
  const expected = getExpectedClinicalDrugSecret();
  const provided = getBearerToken(req);

  return Boolean(expected && provided && provided === expected);
}

module.exports = {
  getExpectedClinicalDrugSecret,
  isClinicalDrugSecretConfigured,
  isAuthorizedClinicalDrugRequest,
};
