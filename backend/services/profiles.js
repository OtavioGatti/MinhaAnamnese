const { isValidUserId } = require('../utils/idValidation');

const ALLOWED_CONTEXTUAL_TABS = new Set(['guide', 'checklist', 'calculator', 'structure']);

function getProfilesAdminConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isProfilesStorageAvailable() {
  const { url, serviceRoleKey } = getProfilesAdminConfig();
  return Boolean(url && serviceRoleKey);
}

function normalizePlan(value) {
  return value === 'pro' ? 'pro' : 'basic';
}

function normalizeContextualTab(value) {
  return ALLOWED_CONTEXTUAL_TABS.has(value) ? value : 'guide';
}

function normalizeTemplateId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildProfileFallback(user, existingProfile = null, overrides = {}) {
  return {
    id: user?.id || existingProfile?.id || null,
    email: user?.email || existingProfile?.email || null,
    current_plan: normalizePlan(
      overrides.current_plan ??
        existingProfile?.current_plan ??
        user?.user_metadata?.plan,
    ),
    last_template_used: normalizeTemplateId(
      overrides.last_template_used ?? existingProfile?.last_template_used,
    ),
    default_contextual_tab: normalizeContextualTab(
      overrides.default_contextual_tab ?? existingProfile?.default_contextual_tab,
    ),
    created_at: existingProfile?.created_at || null,
    updated_at: existingProfile?.updated_at || null,
  };
}

async function getProfileByUserId(userId) {
  if (!isValidUserId(userId) || !isProfilesStorageAvailable()) {
    return null;
  }

  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams({
    select: 'id,email,current_plan,last_template_used,default_contextual_tab,created_at,updated_at',
    id: `eq.${userId}`,
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch profile');
  }

  const json = await response.json();
  return Array.isArray(json) && json[0] ? json[0] : null;
}

async function upsertProfile(fields) {
  if (!isValidUserId(fields?.id) || !isProfilesStorageAvailable()) {
    return null;
  }

  const payload = {
    id: fields.id,
  };

  if ('email' in fields) {
    payload.email = fields.email || null;
  }

  if ('current_plan' in fields) {
    payload.current_plan = normalizePlan(fields.current_plan);
  }

  if ('last_template_used' in fields) {
    payload.last_template_used = normalizeTemplateId(fields.last_template_used);
  }

  if ('default_contextual_tab' in fields) {
    payload.default_contextual_tab = normalizeContextualTab(fields.default_contextual_tab);
  }

  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams({
    on_conflict: 'id',
  });

  const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('failed to upsert profile');
  }

  const json = await response.json();
  return Array.isArray(json) && json[0] ? json[0] : null;
}

function shouldUpdateProfile(existingProfile, nextProfile) {
  if (!existingProfile) {
    return true;
  }

  return (
    existingProfile.email !== nextProfile.email ||
    normalizePlan(existingProfile.current_plan) !== normalizePlan(nextProfile.current_plan) ||
    normalizeTemplateId(existingProfile.last_template_used) !==
      normalizeTemplateId(nextProfile.last_template_used) ||
    normalizeContextualTab(existingProfile.default_contextual_tab) !==
      normalizeContextualTab(nextProfile.default_contextual_tab)
  );
}

async function ensureUserProfile(user, overrides = {}) {
  const existingProfile = await getProfileByUserId(user?.id).catch(() => null);
  const fallbackProfile = buildProfileFallback(user, existingProfile, overrides);

  if (!isProfilesStorageAvailable()) {
    return fallbackProfile;
  }

  if (!shouldUpdateProfile(existingProfile, fallbackProfile)) {
    return fallbackProfile;
  }

  const persistedProfile = await upsertProfile({
    id: fallbackProfile.id,
    email: fallbackProfile.email,
    current_plan: fallbackProfile.current_plan,
    last_template_used: fallbackProfile.last_template_used,
    default_contextual_tab: fallbackProfile.default_contextual_tab,
  });

  return buildProfileFallback(user, persistedProfile || fallbackProfile);
}

module.exports = {
  ALLOWED_CONTEXTUAL_TABS,
  buildProfileFallback,
  ensureUserProfile,
  getProfileByUserId,
  isProfilesStorageAvailable,
  normalizeContextualTab,
  normalizePlan,
  normalizeTemplateId,
  upsertProfile,
};
