const { isValidUserId } = require('../utils/idValidation');

const TRIAL_USAGE_ACTIONS = {
  insights: 'trial_insight',
  referralLetters: 'trial_referral_letter',
  prescriptionGuides: 'trial_prescription_guide',
  userTemplates: 'trial_user_template',
};

const TRIAL_USAGE_LIMITS = {
  insights: parseTrialLimit(process.env.TRIAL_INSIGHTS_LIMIT, 5),
  referralLetters: parseTrialLimit(process.env.TRIAL_REFERRAL_LETTERS_LIMIT, 5),
  prescriptionGuides: parseTrialLimit(process.env.TRIAL_PRESCRIPTION_GUIDES_LIMIT, 5),
  userTemplates: parseTrialLimit(process.env.TRIAL_USER_TEMPLATES_LIMIT, 2),
};

const UNIQUE_RESOURCE_FEATURES = new Set(['prescriptionGuides']);

function parseTrialLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getTrialUsageConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isTrialUsageStorageAvailable() {
  const { url, serviceRoleKey } = getTrialUsageConfig();
  return Boolean(url && serviceRoleKey);
}

function getActionForFeature(feature) {
  return TRIAL_USAGE_ACTIONS[feature] || '';
}

function normalizeResourceKey(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 160) : null;
}

async function requestUsageLogs(path, options = {}) {
  const { url, serviceRoleKey } = getTrialUsageConfig();

  if (!url || !serviceRoleKey) {
    const error = new Error('Trial usage storage unavailable.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${url}/rest/v1/usage_logs${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error('Failed to access trial usage.');
    error.statusCode = response.status >= 500 ? 503 : response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listTrialUsageRows(userId, feature) {
  const action = getActionForFeature(feature);

  if (!isValidUserId(userId) || !action || !isTrialUsageStorageAvailable()) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,resource_key,created_at',
    user_id: `eq.${userId}`,
    action: `eq.${action}`,
    order: 'created_at.asc',
    limit: '1000',
  });
  const json = await requestUsageLogs(`?${query.toString()}`, { method: 'GET' });

  return Array.isArray(json) ? json : [];
}

function countUsageRows(feature, rows) {
  if (!UNIQUE_RESOURCE_FEATURES.has(feature)) {
    return rows.length;
  }

  const uniqueKeys = new Set();

  rows.forEach((row) => {
    const key = normalizeResourceKey(row?.resource_key) || row?.id;

    if (key) {
      uniqueKeys.add(key);
    }
  });

  return uniqueKeys.size;
}

async function getTrialFeatureUsage(userId, feature, resourceKey = null) {
  const limit = TRIAL_USAGE_LIMITS[feature] ?? 0;
  const normalizedResourceKey = normalizeResourceKey(resourceKey);
  const rows = await listTrialUsageRows(userId, feature);
  const used = countUsageRows(feature, rows);
  const hasResourceUsage = Boolean(
    normalizedResourceKey &&
      rows.some((row) => normalizeResourceKey(row?.resource_key) === normalizedResourceKey),
  );

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    hasResourceUsage,
  };
}

async function getTrialUsageSummary(userId) {
  if (!isValidUserId(userId) || !isTrialUsageStorageAvailable()) {
    return {
      limits: { ...TRIAL_USAGE_LIMITS },
      used: {
        insights: 0,
        referralLetters: 0,
        prescriptionGuides: 0,
        userTemplates: 0,
      },
      remaining: { ...TRIAL_USAGE_LIMITS },
    };
  }

  const entries = await Promise.all(
    Object.keys(TRIAL_USAGE_LIMITS).map(async (feature) => {
      const usage = await getTrialFeatureUsage(userId, feature);
      return [feature, usage];
    }),
  );
  const used = {};
  const remaining = {};

  entries.forEach(([feature, usage]) => {
    used[feature] = usage.used;
    remaining[feature] = usage.remaining;
  });

  return {
    limits: { ...TRIAL_USAGE_LIMITS },
    used,
    remaining,
  };
}

async function ensureTrialFeatureAccess({ userId, profile, feature, resourceKey = null }) {
  if (!profile?.access_state?.isTrialAccess) {
    return {
      allowed: true,
      usage: null,
    };
  }

  if (!isTrialUsageStorageAvailable()) {
    return {
      allowed: false,
      usage: {
        limit: TRIAL_USAGE_LIMITS[feature] ?? 0,
        used: TRIAL_USAGE_LIMITS[feature] ?? 0,
        remaining: 0,
        hasResourceUsage: false,
      },
    };
  }

  const usage = await getTrialFeatureUsage(userId, feature, resourceKey);

  if (usage.hasResourceUsage || usage.remaining > 0) {
    return {
      allowed: true,
      usage,
    };
  }

  return {
    allowed: false,
    usage,
  };
}

async function recordTrialUsage({ userId, profile, feature, resourceKey = null, metadata = null }) {
  if (!profile?.access_state?.isTrialAccess || !isValidUserId(userId)) {
    return null;
  }

  const action = getActionForFeature(feature);

  if (!action || !isTrialUsageStorageAvailable()) {
    return null;
  }

  const normalizedResourceKey = normalizeResourceKey(resourceKey);

  if (normalizedResourceKey) {
    const usage = await getTrialFeatureUsage(userId, feature, normalizedResourceKey);

    if (usage.hasResourceUsage) {
      return null;
    }
  }

  const payload = {
    user_id: userId,
    action,
    resource_key: normalizedResourceKey,
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
  };

  return requestUsageLogs('', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

function buildTrialLimitError(feature, usage = null) {
  const limit = usage?.limit ?? TRIAL_USAGE_LIMITS[feature] ?? 0;
  const error = new Error(`Limite do teste profissional atingido para este recurso.`);
  error.statusCode = 402;
  error.code = 'TRIAL_LIMIT_REACHED';
  error.data = {
    feature,
    limit,
    used: usage?.used ?? limit,
    remaining: 0,
  };
  return error;
}

module.exports = {
  buildTrialLimitError,
  ensureTrialFeatureAccess,
  getTrialFeatureUsage,
  getTrialUsageSummary,
  recordTrialUsage,
  TRIAL_USAGE_LIMITS,
};
