const buckets = new Map();
let lastCleanupAt = 0;

function getHeaderValue(req, name) {
  const value = req?.headers?.[name] || req?.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return typeof value === 'string' ? value : '';
}

function getClientIp(req) {
  const forwardedFor = getHeaderValue(req, 'x-forwarded-for');
  const firstForwardedIp = forwardedFor.split(',')[0]?.trim();

  return (
    firstForwardedIp ||
    getHeaderValue(req, 'x-real-ip').trim() ||
    req?.ip ||
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

function consumeRateLimit({ req, scope, userId = null, limit, windowMs }) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const identity = userId ? `user:${userId}` : `ip:${getClientIp(req)}`;
  const key = `${scope}:${identity}`;
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
  consumeRateLimit,
  getClientIp,
  sendRateLimitResponse,
};
