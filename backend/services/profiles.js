const { isValidUserId } = require('../utils/idValidation');
const {
  normalizeAccessSource,
  normalizeBillingStatus,
  normalizeFreeInsightsCount,
  normalizePlanExpiresAt,
  resolveUserAccessState,
} = require('./accessState');
const { getTrialUsageSummary } = require('./trialUsage');

const ALLOWED_CONTEXTUAL_TABS = new Set(['guide', 'checklist', 'calculator', 'structure']);
const DEFAULT_TRIAL_DAYS = 7;
const DEFAULT_TRIAL_ROLLOUT_AT = '2026-05-14T00:00:00.000Z';
const OPTIONAL_COMPLIANCE_COLUMNS = [
  'terms_accepted_at',
  'terms_scrolled_at',
  'terms_version',
  'privacy_accepted_at',
  'privacy_scrolled_at',
  'privacy_version',
  'cookie_consent_status',
  'cookie_consent_at',
  'cookie_consent_version',
];

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
  if (value === 'pro') {
    return 'pro';
  }

  if (value === 'affiliate' || value === 'afiliado') {
    return 'affiliate';
  }

  return 'basic';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTrialDays() {
  return parsePositiveInteger(process.env.PRO_TRIAL_DAYS, DEFAULT_TRIAL_DAYS);
}

function getTrialRolloutTimestamp() {
  const configured = process.env.PRO_TRIAL_ROLLOUT_AT || DEFAULT_TRIAL_ROLLOUT_AT;
  const parsed = new Date(configured).getTime();
  return Number.isFinite(parsed) ? parsed : new Date(DEFAULT_TRIAL_ROLLOUT_AT).getTime();
}

function getUserCreatedAtTimestamp(user) {
  const candidates = [
    user?.created_at,
    user?.createdAt,
    user?.user_metadata?.created_at,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = new Date(candidate).getTime();

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function shouldStartAutomaticTrial(user, existingProfile, overrides = {}) {
  if (existingProfile || !isValidUserId(user?.id)) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(overrides, 'current_plan')) {
    return false;
  }

  if (normalizePlan(user?.user_metadata?.plan) === 'pro') {
    return false;
  }

  return getUserCreatedAtTimestamp(user) >= getTrialRolloutTimestamp();
}

function buildTrialOverrides() {
  const now = new Date();
  const planExpiresAt = new Date(now.getTime() + getTrialDays() * 86400000);

  return {
    current_plan: 'pro',
    billing_status: 'active',
    access_source: 'trial',
    trial_started_at: now.toISOString(),
    plan_expires_at: planExpiresAt.toISOString(),
  };
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

function normalizeLegalVersion(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 32) : null;
}

function normalizeCookieConsentStatus(value) {
  return value === 'accepted' || value === 'rejected' ? value : null;
}

function getMetadataTimestamp(user, ...keys) {
  for (const key of keys) {
    const normalized = normalizePlanExpiresAt(user?.user_metadata?.[key]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function getMetadataText(user, ...keys) {
  for (const key of keys) {
    const normalized = normalizeLegalVersion(user?.user_metadata?.[key]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildProfileFallback(user, existingProfile = null, overrides = {}) {
  const profile = {
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
    billing_status: normalizeBillingStatus(
      overrides.billing_status ?? existingProfile?.billing_status,
    ),
    access_source: normalizeAccessSource(
      overrides.access_source ?? existingProfile?.access_source,
    ),
    plan_expires_at: normalizePlanExpiresAt(
      overrides.plan_expires_at ?? existingProfile?.plan_expires_at,
    ),
    free_full_insights_used_count: normalizeFreeInsightsCount(
      overrides.free_full_insights_used_count ?? existingProfile?.free_full_insights_used_count,
    ),
    trial_started_at: normalizePlanExpiresAt(
      overrides.trial_started_at ?? existingProfile?.trial_started_at,
    ),
    welcome_onboarding_seen_at: normalizePlanExpiresAt(
      overrides.welcome_onboarding_seen_at ?? existingProfile?.welcome_onboarding_seen_at,
    ),
    terms_accepted_at: normalizePlanExpiresAt(
      overrides.terms_accepted_at ??
        existingProfile?.terms_accepted_at ??
        getMetadataTimestamp(user, 'terms_accepted_at', 'termsAcceptedAt'),
    ),
    terms_scrolled_at: normalizePlanExpiresAt(
      overrides.terms_scrolled_at ??
        existingProfile?.terms_scrolled_at ??
        getMetadataTimestamp(user, 'terms_scrolled_at', 'termsScrolledAt'),
    ),
    terms_version: normalizeLegalVersion(
      overrides.terms_version ??
        existingProfile?.terms_version ??
        getMetadataText(user, 'terms_version', 'termsVersion'),
    ),
    privacy_accepted_at: normalizePlanExpiresAt(
      overrides.privacy_accepted_at ??
        existingProfile?.privacy_accepted_at ??
        getMetadataTimestamp(user, 'privacy_accepted_at', 'privacyAcceptedAt'),
    ),
    privacy_scrolled_at: normalizePlanExpiresAt(
      overrides.privacy_scrolled_at ??
        existingProfile?.privacy_scrolled_at ??
        getMetadataTimestamp(user, 'privacy_scrolled_at', 'privacyScrolledAt'),
    ),
    privacy_version: normalizeLegalVersion(
      overrides.privacy_version ??
        existingProfile?.privacy_version ??
        getMetadataText(user, 'privacy_version', 'privacyVersion'),
    ),
    cookie_consent_status: normalizeCookieConsentStatus(
      overrides.cookie_consent_status ?? existingProfile?.cookie_consent_status,
    ),
    cookie_consent_at: normalizePlanExpiresAt(
      overrides.cookie_consent_at ?? existingProfile?.cookie_consent_at,
    ),
    cookie_consent_version: normalizeLegalVersion(
      overrides.cookie_consent_version ?? existingProfile?.cookie_consent_version,
    ),
    last_payment_id:
      Object.prototype.hasOwnProperty.call(overrides, 'last_payment_id')
        ? overrides.last_payment_id || null
        : existingProfile?.last_payment_id || null,
    created_at: existingProfile?.created_at || null,
    updated_at: existingProfile?.updated_at || null,
  };

  return {
    ...profile,
    access_state: resolveUserAccessState({ user, profile }),
  };
}

async function getProfileByUserId(userId) {
  if (!isValidUserId(userId) || !isProfilesStorageAvailable()) {
    return null;
  }

  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams({
    select: '*',
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

  if ('billing_status' in fields) {
    payload.billing_status = normalizeBillingStatus(fields.billing_status);
  }

  if ('access_source' in fields) {
    payload.access_source = normalizeAccessSource(fields.access_source);
  }

  if ('plan_expires_at' in fields) {
    payload.plan_expires_at = normalizePlanExpiresAt(fields.plan_expires_at);
  }

  if ('free_full_insights_used_count' in fields) {
    payload.free_full_insights_used_count = normalizeFreeInsightsCount(fields.free_full_insights_used_count);
  }

  if ('trial_started_at' in fields) {
    payload.trial_started_at = normalizePlanExpiresAt(fields.trial_started_at);
  }

  if ('welcome_onboarding_seen_at' in fields) {
    payload.welcome_onboarding_seen_at = normalizePlanExpiresAt(fields.welcome_onboarding_seen_at);
  }

  if ('terms_accepted_at' in fields) {
    payload.terms_accepted_at = normalizePlanExpiresAt(fields.terms_accepted_at);
  }

  if ('terms_scrolled_at' in fields) {
    payload.terms_scrolled_at = normalizePlanExpiresAt(fields.terms_scrolled_at);
  }

  if ('terms_version' in fields) {
    payload.terms_version = normalizeLegalVersion(fields.terms_version);
  }

  if ('privacy_accepted_at' in fields) {
    payload.privacy_accepted_at = normalizePlanExpiresAt(fields.privacy_accepted_at);
  }

  if ('privacy_scrolled_at' in fields) {
    payload.privacy_scrolled_at = normalizePlanExpiresAt(fields.privacy_scrolled_at);
  }

  if ('privacy_version' in fields) {
    payload.privacy_version = normalizeLegalVersion(fields.privacy_version);
  }

  if ('cookie_consent_status' in fields) {
    payload.cookie_consent_status = normalizeCookieConsentStatus(fields.cookie_consent_status);
  }

  if ('cookie_consent_at' in fields) {
    payload.cookie_consent_at = normalizePlanExpiresAt(fields.cookie_consent_at);
  }

  if ('cookie_consent_version' in fields) {
    payload.cookie_consent_version = normalizeLegalVersion(fields.cookie_consent_version);
  }

  if ('last_payment_id' in fields) {
    payload.last_payment_id = fields.last_payment_id || null;
  }

  const { url, serviceRoleKey } = getProfilesAdminConfig();
  const query = new URLSearchParams({
    on_conflict: 'id',
  });

  function omitOptionalComplianceFields(source) {
    return Object.fromEntries(
      Object.entries(source).filter(([key]) => !OPTIONAL_COMPLIANCE_COLUMNS.includes(key)),
    );
  }

  async function sendProfileUpsert(nextPayload) {
    const response = await fetch(`${url}/rest/v1/profiles?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(nextPayload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      const error = new Error('failed to upsert profile');
      error.statusCode = response.status;
      error.details = details;
      throw error;
    }

    const json = await response.json();
    return Array.isArray(json) && json[0] ? json[0] : null;
  }

  try {
    return await sendProfileUpsert(payload);
  } catch (error) {
    const hasOptionalComplianceFields = OPTIONAL_COMPLIANCE_COLUMNS.some((key) =>
      Object.prototype.hasOwnProperty.call(payload, key),
    );

    if (!hasOptionalComplianceFields || error.statusCode !== 400) {
      throw error;
    }

    return sendProfileUpsert(omitOptionalComplianceFields(payload));
  }
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
      normalizeContextualTab(nextProfile.default_contextual_tab) ||
    normalizeBillingStatus(existingProfile.billing_status) !== normalizeBillingStatus(nextProfile.billing_status) ||
    normalizeAccessSource(existingProfile.access_source) !== normalizeAccessSource(nextProfile.access_source) ||
    normalizePlanExpiresAt(existingProfile.plan_expires_at) !== normalizePlanExpiresAt(nextProfile.plan_expires_at) ||
    normalizeFreeInsightsCount(existingProfile.free_full_insights_used_count) !==
      normalizeFreeInsightsCount(nextProfile.free_full_insights_used_count) ||
    normalizePlanExpiresAt(existingProfile.trial_started_at) !== normalizePlanExpiresAt(nextProfile.trial_started_at) ||
    normalizePlanExpiresAt(existingProfile.welcome_onboarding_seen_at) !==
      normalizePlanExpiresAt(nextProfile.welcome_onboarding_seen_at) ||
    normalizePlanExpiresAt(existingProfile.terms_accepted_at) !==
      normalizePlanExpiresAt(nextProfile.terms_accepted_at) ||
    normalizePlanExpiresAt(existingProfile.terms_scrolled_at) !==
      normalizePlanExpiresAt(nextProfile.terms_scrolled_at) ||
    normalizeLegalVersion(existingProfile.terms_version) !== normalizeLegalVersion(nextProfile.terms_version) ||
    normalizePlanExpiresAt(existingProfile.privacy_accepted_at) !==
      normalizePlanExpiresAt(nextProfile.privacy_accepted_at) ||
    normalizePlanExpiresAt(existingProfile.privacy_scrolled_at) !==
      normalizePlanExpiresAt(nextProfile.privacy_scrolled_at) ||
    normalizeLegalVersion(existingProfile.privacy_version) !== normalizeLegalVersion(nextProfile.privacy_version) ||
    normalizeCookieConsentStatus(existingProfile.cookie_consent_status) !==
      normalizeCookieConsentStatus(nextProfile.cookie_consent_status) ||
    normalizePlanExpiresAt(existingProfile.cookie_consent_at) !==
      normalizePlanExpiresAt(nextProfile.cookie_consent_at) ||
    normalizeLegalVersion(existingProfile.cookie_consent_version) !==
      normalizeLegalVersion(nextProfile.cookie_consent_version) ||
    (existingProfile.last_payment_id || null) !== (nextProfile.last_payment_id || null)
  );
}

async function expireProfileAccessIfNeeded(user, profile) {
  const accessState = resolveUserAccessState({ user, profile });

  if (!accessState.isProExpired || !isProfilesStorageAvailable() || !isValidUserId(profile?.id)) {
    return {
      ...profile,
      access_state: accessState,
    };
  }

  const persistedProfile = await upsertProfile({
    id: profile.id,
    email: profile.email,
    current_plan: 'basic',
    billing_status: 'expired',
    access_source: profile.access_source,
    plan_expires_at: profile.plan_expires_at,
    free_full_insights_used_count: profile.free_full_insights_used_count,
    trial_started_at: profile.trial_started_at,
    welcome_onboarding_seen_at: profile.welcome_onboarding_seen_at,
    terms_accepted_at: profile.terms_accepted_at,
    terms_scrolled_at: profile.terms_scrolled_at,
    terms_version: profile.terms_version,
    privacy_accepted_at: profile.privacy_accepted_at,
    privacy_scrolled_at: profile.privacy_scrolled_at,
    privacy_version: profile.privacy_version,
    cookie_consent_status: profile.cookie_consent_status,
    cookie_consent_at: profile.cookie_consent_at,
    cookie_consent_version: profile.cookie_consent_version,
    last_payment_id: profile.last_payment_id,
    last_template_used: profile.last_template_used,
    default_contextual_tab: profile.default_contextual_tab,
  }).catch(() => null);

  const nextProfile = persistedProfile || {
    ...profile,
    current_plan: 'basic',
    billing_status: 'expired',
  };

  return {
    ...nextProfile,
    access_state: resolveUserAccessState({ user, profile: nextProfile }),
  };
}

async function ensureUserProfile(user, overrides = {}) {
  const existingProfile = await getProfileByUserId(user?.id).catch(() => null);
  const nextOverrides = shouldStartAutomaticTrial(user, existingProfile, overrides)
    ? {
        ...buildTrialOverrides(),
        ...overrides,
      }
    : overrides;
  const fallbackProfile = buildProfileFallback(user, existingProfile, nextOverrides);

  if (!isProfilesStorageAvailable()) {
    return withTrialUsageSummary(fallbackProfile);
  }

  if (!shouldUpdateProfile(existingProfile, fallbackProfile)) {
    return withTrialUsageSummary(await expireProfileAccessIfNeeded(user, fallbackProfile));
  }

  const persistedProfile = await upsertProfile({
    id: fallbackProfile.id,
    email: fallbackProfile.email,
    current_plan: fallbackProfile.current_plan,
    last_template_used: fallbackProfile.last_template_used,
    default_contextual_tab: fallbackProfile.default_contextual_tab,
    billing_status: fallbackProfile.billing_status,
    access_source: fallbackProfile.access_source,
    plan_expires_at: fallbackProfile.plan_expires_at,
    free_full_insights_used_count: fallbackProfile.free_full_insights_used_count,
    trial_started_at: fallbackProfile.trial_started_at,
    welcome_onboarding_seen_at: fallbackProfile.welcome_onboarding_seen_at,
    terms_accepted_at: fallbackProfile.terms_accepted_at,
    terms_scrolled_at: fallbackProfile.terms_scrolled_at,
    terms_version: fallbackProfile.terms_version,
    privacy_accepted_at: fallbackProfile.privacy_accepted_at,
    privacy_scrolled_at: fallbackProfile.privacy_scrolled_at,
    privacy_version: fallbackProfile.privacy_version,
    cookie_consent_status: fallbackProfile.cookie_consent_status,
    cookie_consent_at: fallbackProfile.cookie_consent_at,
    cookie_consent_version: fallbackProfile.cookie_consent_version,
    last_payment_id: fallbackProfile.last_payment_id,
  });

  return withTrialUsageSummary(
    await expireProfileAccessIfNeeded(user, buildProfileFallback(user, persistedProfile || fallbackProfile)),
  );
}

async function withTrialUsageSummary(profile) {
  if (!profile?.id || (!profile?.access_state?.isTrialAccess && !profile?.access_state?.isTrialExpired)) {
    return profile;
  }

  const trialUsage = await getTrialUsageSummary(profile.id).catch(() => null);

  return {
    ...profile,
    trial_usage: trialUsage,
  };
}

module.exports = {
  ALLOWED_CONTEXTUAL_TABS,
  buildProfileFallback,
  ensureUserProfile,
  getProfileByUserId,
  getTrialDays,
  isProfilesStorageAvailable,
  normalizeContextualTab,
  normalizePlan,
  normalizeTemplateId,
  upsertProfile,
  withTrialUsageSummary,
};
