const buckets = new Map();
let lastCleanupAt = 0;
let supabaseDisabledUntil = 0;

const SUPABASE_RPC_TIMEOUT_MS = 2000;
const SUPABASE_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

// Valor de app.set('trust proxy', ...) no server.js. O Render encadeia mais de
// um proxy interno (10.x) antes do serviço, então "1" (um hop) resolvia req.ip
// para o IP do proxy e todo mundo caía no mesmo bucket. Confiar nas faixas
// privadas faz o Express andar a lista de x-forwarded-for a partir do fim e
// parar no primeiro IP público: o cliente real, visto pelo proxy. O que o
// cliente forjou fica à esquerda e é ignorado.
const TRUST_PROXY_SETTING = 'loopback, linklocal, uniquelocal';

function getHeaderValue(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function getClientIp(req) {
  // Atrás do Render o Express resolve req.ip com TRUST_PROXY_SETTING
  // (server.js): o primeiro IP público contando do fim de x-forwarded-for,
  // não a entrada que o cliente mandou. É a única fonte que não dá para forjar.
  const expressIp = typeof req?.ip === 'string' ? req.ip.trim() : '';

  if (expressIp) {
    return expressIp;
  }

  // Sem Express (functions da Vercel) os cabeçalhos são reescritos pela
  // plataforma. Mesmo assim, fica a ÚLTIMA entrada da lista — a que o proxy
  // mais próximo anexou — e nunca a primeira, que vem do cliente.
  const forwardedFor = getHeaderValue(req, 'x-forwarded-for');
  const forwardedIps = forwardedFor
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const lastForwardedIp = forwardedIps[forwardedIps.length - 1] || '';

  return (
    lastForwardedIp ||
    getHeaderValue(req, 'x-real-ip').trim() ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    'unknown'
  );
}

function cleanupExpiredBuckets(now) {
  if (now - lastCleanupAt < 60000) {
    return;
  }

  lastCleanupAt = now;

  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function consumeMemoryRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existingBucket = buckets.get(key);
  const bucket = existingBucket && existingBucket.resetAt > now
    ? existingBucket
    : {
        count: 0,
        resetAt: now + windowMs,
      };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= limit) {
    return {
      allowed: true,
      remaining: limit - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function getSupabaseRateLimitConfig() {
  if (String(process.env.RATE_LIMIT_STORE || '').toLowerCase() === 'memory') {
    return null;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
  };
}

function normalizeSupabaseRateLimitResult(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.allowed !== 'boolean') {
    return null;
  }

  const remaining = Number(payload.remaining);
  const retryAfterSeconds = Number(payload.retry_after_seconds);

  return {
    allowed: payload.allowed,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 60,
  };
}

async function consumeSupabaseRateLimit({ key, limit, windowMs }) {
  const config = getSupabaseRateLimitConfig();

  if (!config || Date.now() < supabaseDisabledUntil) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_RPC_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_bucket_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      supabaseDisabledUntil = Date.now() + SUPABASE_FAILURE_COOLDOWN_MS;
      return null;
    }

    return normalizeSupabaseRateLimitResult(await response.json());
  } catch (_error) {
    supabaseDisabledUntil = Date.now() + SUPABASE_FAILURE_COOLDOWN_MS;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function consumeRateLimit({ req, scope, userId = null, limit, windowMs }) {
  const identity = userId ? `user:${userId}` : `ip:${getClientIp(req)}`;
  const key = `${scope}:${identity}`;

  const supabaseResult = await consumeSupabaseRateLimit({ key, limit, windowMs });

  if (supabaseResult) {
    return supabaseResult;
  }

  return consumeMemoryRateLimit({ key, limit, windowMs });
}

function sendRateLimitResponse(res, result) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Retry-After', String(result.retryAfterSeconds || 60));
  }

  return res.status(429).json({
    success: false,
    error: 'Muitas solicitações em sequência. Aguarde um momento e tente novamente.',
  });
}

module.exports = {
  TRUST_PROXY_SETTING,
  consumeRateLimit,
  getClientIp,
  sendRateLimitResponse,
};
