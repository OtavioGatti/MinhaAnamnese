function getHeaderValue(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function getBearerToken(req) {
  const authorization = getHeaderValue(req, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function hasAdminSecretConfigured() {
  return Boolean(process.env.ADMIN_SYNC_SECRET);
}

function isAuthorizedAdminRequest(req) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET || '';
  const providedSecret = getBearerToken(req);

  return Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);
}

module.exports = {
  getBearerToken,
  getHeaderValue,
  hasAdminSecretConfigured,
  isAuthorizedAdminRequest,
};
