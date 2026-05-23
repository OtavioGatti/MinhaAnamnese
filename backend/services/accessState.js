function normalizePlan(value) {
  if (value === 'pro') {
    return 'pro';
  }

  if (value === 'affiliate' || value === 'afiliado') {
    return 'affiliate';
  }

  return 'basic';
}

function normalizeBillingStatus(value) {
  return ['inactive', 'active', 'expired'].includes(value) ? value : 'inactive';
}

function normalizeAccessSource(value) {
  return ['none', 'trial', 'paid', 'legacy'].includes(value) ? value : 'none';
}

function normalizeFreeInsightsCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePlanExpiresAt(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isPlanExpired(planExpiresAt) {
  if (!planExpiresAt) {
    return false;
  }

  return new Date(planExpiresAt).getTime() <= Date.now();
}

function shouldUseLegacyMetadataFallback(user, profile) {
  if (normalizePlan(user?.user_metadata?.plan) !== 'pro') {
    return false;
  }

  if (!profile) {
    return true;
  }

  if (normalizeBillingStatus(profile.billing_status) !== 'inactive') {
    return false;
  }

  if (normalizePlanExpiresAt(profile.plan_expires_at)) {
    return false;
  }

  return true;
}

function resolveUserAccessState({ user, profile }) {
  const normalizedCurrentPlan = normalizePlan(profile?.current_plan);
  const normalizedBillingStatus = normalizeBillingStatus(profile?.billing_status);
  const normalizedAccessSource = normalizeAccessSource(profile?.access_source);
  const normalizedPlanExpiresAt = normalizePlanExpiresAt(profile?.plan_expires_at);
  const freeFullInsightsUsedCount = normalizeFreeInsightsCount(profile?.free_full_insights_used_count);
  const expiredByDate = isPlanExpired(normalizedPlanExpiresAt);
  const expiredProfile =
    normalizedCurrentPlan === 'pro' && (normalizedBillingStatus === 'expired' || expiredByDate);
  const isAffiliate = normalizedCurrentPlan === 'affiliate';
  const hasProfileProAccess =
    isAffiliate ||
    (
      normalizedCurrentPlan === 'pro' &&
      normalizedBillingStatus === 'active' &&
      !expiredByDate
    );
  const hasLegacyMetadataAccess = shouldUseLegacyMetadataFallback(user, profile);
  const hasActiveProAccess = hasProfileProAccess || hasLegacyMetadataAccess;
  const effectivePlan = isAffiliate ? 'affiliate' : hasActiveProAccess ? 'pro' : 'basic';
  const accessSource = hasLegacyMetadataAccess
    ? 'legacy'
    : hasProfileProAccess
      ? (normalizedAccessSource === 'none' ? 'paid' : normalizedAccessSource)
      : normalizedAccessSource;
  const isTrialAccess = hasProfileProAccess && accessSource === 'trial';
  const isPaidProAccess = hasActiveProAccess && !isTrialAccess;
  const trialEndsAt = isTrialAccess ? normalizedPlanExpiresAt : null;
  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;
  const isTrialExpired = accessSource === 'trial' && (expiredProfile || normalizedBillingStatus === 'expired');
  const freeFullInsightsRemaining = 0;

  return {
    effectivePlan,
    hasActiveProAccess,
    isAffiliate,
    isTrialAccess,
    isPaidProAccess,
    isTrialExpired,
    accessSource,
    trialEndsAt,
    trialDaysRemaining,
    hasFreeFullInsightAvailable: false,
    freeFullInsightsRemaining,
    freeFullInsightsUsedCount,
    billingStatus: expiredProfile ? 'expired' : normalizedBillingStatus,
    planExpiresAt: normalizedPlanExpiresAt,
    isProExpired: expiredProfile,
  };
}

module.exports = {
  normalizeAccessSource,
  normalizeBillingStatus,
  normalizeFreeInsightsCount,
  normalizePlan,
  normalizePlanExpiresAt,
  resolveUserAccessState,
};
