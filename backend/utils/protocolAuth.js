// Autorização das rotas da automação de protocolos. Segredo dedicado
// PROTOCOL_AUTOMATION_SECRET com fallback para ADMIN_SYNC_SECRET, reusando o
// parser de bearer token de adminAuth.js.

const { getBearerToken } = require('./adminAuth');

function getExpectedProtocolSecret() {
  return process.env.PROTOCOL_AUTOMATION_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function isProtocolSecretConfigured() {
  return Boolean(getExpectedProtocolSecret());
}

function isAuthorizedProtocolRequest(req) {
  const expected = getExpectedProtocolSecret();
  const provided = getBearerToken(req);

  return Boolean(expected && provided && provided === expected);
}

module.exports = {
  getExpectedProtocolSecret,
  isProtocolSecretConfigured,
  isAuthorizedProtocolRequest,
};
