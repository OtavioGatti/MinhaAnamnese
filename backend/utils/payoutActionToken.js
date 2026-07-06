const crypto = require('crypto');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTION_PATH = 'api/affiliate-payout-action';

function getActionSecret() {
  return process.env.PAYOUT_ACTION_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function signPayoutAction(payoutId, action, exp) {
  return crypto
    .createHmac('sha256', getActionSecret())
    .update(`${payoutId}:${action}:${exp}`)
    .digest('hex');
}

function createPayoutActionToken(payoutId, action, ttlMs = DEFAULT_TTL_MS) {
  if (!getActionSecret()) {
    return null;
  }

  const exp = Date.now() + ttlMs;
  return { exp, sig: signPayoutAction(payoutId, action, exp) };
}

function verifyPayoutActionToken({ payoutId, action, exp, sig }) {
  const secret = getActionSecret();

  if (!secret || !payoutId || !action || !sig) {
    return false;
  }

  const expNumber = Number(exp);

  if (!Number.isFinite(expNumber) || expNumber < Date.now()) {
    return false;
  }

  const expected = signPayoutAction(payoutId, action, expNumber);
  const provided = String(sig);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function normalizeApiBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');

  if (!raw) {
    return '';
  }

  const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withProtocol.replace(/\/api$/, '');
}

function getPublicApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.PUBLIC_API_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_BASE_URL,
  );
}

function buildPayoutActionUrl(baseUrl, payoutId, action, token) {
  const query = new URLSearchParams({
    payout: payoutId,
    action,
    exp: String(token.exp),
    sig: token.sig,
  });

  return `${baseUrl}/${ACTION_PATH}?${query.toString()}`;
}

// Gera os links assinados de baixa (pago/rejeitado) para a notificação.
// Usa a URL derivada da requisição (options.baseUrl) e, se ausente, a env
// PUBLIC_API_URL. Retorna null se faltar segredo ou URL — a notificação segue
// sem links (fallback amigável).
function buildPayoutActionUrls(payoutId, options = {}) {
  const { baseUrl: requestBaseUrl, ttlMs = DEFAULT_TTL_MS } = options;
  const baseUrl = normalizeApiBaseUrl(requestBaseUrl) || getPublicApiBaseUrl();
  const paidToken = createPayoutActionToken(payoutId, 'paid', ttlMs);
  const rejectedToken = createPayoutActionToken(payoutId, 'rejected', ttlMs);

  if (!baseUrl || !paidToken || !rejectedToken) {
    return null;
  }

  return {
    paid: buildPayoutActionUrl(baseUrl, payoutId, 'paid', paidToken),
    rejected: buildPayoutActionUrl(baseUrl, payoutId, 'rejected', rejectedToken),
  };
}

module.exports = {
  buildPayoutActionUrls,
  createPayoutActionToken,
  getActionSecret,
  verifyPayoutActionToken,
};
