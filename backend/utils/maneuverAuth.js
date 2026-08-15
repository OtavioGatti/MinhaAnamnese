// Autorização das rotas da automação de manobras. Segredo dedicado
// MANEUVER_AUTOMATION_SECRET com fallback para PROTOCOL_AUTOMATION_SECRET e
// ADMIN_SYNC_SECRET, reusando o parser de bearer token de adminAuth.js.
// O fallback mantém o painel funcionando com o token que ele já usa hoje.

const { getBearerToken } = require('./adminAuth');

function getExpectedManeuverSecret() {
  return process.env.MANEUVER_AUTOMATION_SECRET ||
    process.env.PROTOCOL_AUTOMATION_SECRET ||
    process.env.ADMIN_SYNC_SECRET ||
    '';
}

function isManeuverSecretConfigured() {
  return Boolean(getExpectedManeuverSecret());
}

function isAuthorizedManeuverRequest(req) {
  const expected = getExpectedManeuverSecret();
  const provided = getBearerToken(req);

  return Boolean(expected && provided && provided === expected);
}

module.exports = {
  getExpectedManeuverSecret,
  isAuthorizedManeuverRequest,
  isManeuverSecretConfigured,
};
