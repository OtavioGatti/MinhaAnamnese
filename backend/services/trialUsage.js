const { isValidUserId } = require('../utils/idValidation');

const TRIAL_USAGE_ACTIONS = {
  insights: 'trial_insight',
  referralLetters: 'trial_referral_letter',
  diagnosticHypotheses: 'trial_diagnostic_hypotheses',
  prescriptionGuides: 'trial_prescription_guide',
  userTemplates: 'trial_user_template',
};
const TRIAL_USAGE_FEATURES = Object.keys(TRIAL_USAGE_ACTIONS);

const UNIQUE_RESOURCE_FEATURES = new Set(['prescriptionGuides']);

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
  const normalizedResourceKey = normalizeResourceKey(resourceKey);
  const rows = await listTrialUsageRows(userId, feature);
  const used = countUsageRows(feature, rows);
  const hasResourceUsage = Boolean(
    normalizedResourceKey &&
      rows.some((row) => normalizeResourceKey(row?.resource_key) === normalizedResourceKey),
  );

  return {
    used,
    hasResourceUsage,
  };
}

async function getTrialUsageSummary(userId) {
  if (!isValidUserId(userId) || !isTrialUsageStorageAvailable()) {
    return {
      used: {
        insights: 0,
        referralLetters: 0,
        diagnosticHypotheses: 0,
        prescriptionGuides: 0,
        userTemplates: 0,
      },
    };
  }

  const entries = await Promise.all(
    TRIAL_USAGE_FEATURES.map(async (feature) => {
      const usage = await getTrialFeatureUsage(userId, feature);
      return [feature, usage];
    }),
  );
  const used = {};

  entries.forEach(([feature, usage]) => {
    used[feature] = usage.used;
  });

  return {
    used,
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

module.exports = {
  getTrialFeatureUsage,
  getTrialUsageSummary,
  recordTrialUsage,
  TRIAL_USAGE_ACTIONS,
};
