// Link assinado do painel de métricas — mesmo mecanismo do link de baixa de
// repasse (utils/payoutActionToken.js), separado porque o escopo é outro: aqui
// o token dá LEITURA de agregados do negócio, não ação sobre um repasse.
//
// A validade é longa de propósito: o dono guarda o link nos favoritos. Quando
// vencer, é só gerar outro. Trocar ADMIN_SYNC_SECRET invalida todos.

const crypto = require('crypto');

const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SCOPE = 'owner-metrics';

function getMetricsSecret() {
  return process.env.OWNER_METRICS_SECRET || process.env.ADMIN_SYNC_SECRET || '';
}

function sign(exp) {
  return crypto
    .createHmac('sha256', getMetricsSecret())
    .update(`${SCOPE}:${exp}`)
    .digest('hex');
}

function createOwnerMetricsToken(ttlMs = DEFAULT_TTL_MS) {
  if (!getMetricsSecret()) {
    return null;
  }

  const exp = Date.now() + ttlMs;
  return { exp, sig: sign(exp) };
}

function verifyOwnerMetricsToken({ exp, sig }) {
  const secret = getMetricsSecret();

  if (!secret || !sig) {
    return false;
  }

  const expNumber = Number(exp);

  if (!Number.isFinite(expNumber) || expNumber < Date.now()) {
    return false;
  }

  const expected = sign(expNumber);
  const provided = String(sig);

  // Comparação de tamanho antes: timingSafeEqual lança se diferirem.
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

module.exports = {
  DEFAULT_TTL_MS,
  createOwnerMetricsToken,
  getMetricsSecret,
  verifyOwnerMetricsToken,
};
