function normalizePlan(value) {
  return value === 'pro' ? 'pro' : 'basic';
}

function normalizeBillingStatus(value) {
  return ['inactive', 'active', 'expired'].includes(value) ? value : 'inactive';
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
  const normalizedPlanExpiresAt = normalizePlanExpiresAt(profile?.plan_expires_at);
  const freeFullInsightsUsedCount = normalizeFreeInsightsCount(profile?.free_full_insights_used_count);
  const expiredByDate = isPlanExpired(normalizedPlanExpiresAt);
  const expiredProfile =
    normalizedCurrentPlan === 'pro' && (normalizedBillingStatus === 'expired' || expiredByDate);
  const hasProfileProAccess =
    normalizedCurrentPlan === 'pro' &&
    normalizedBillingStatus === 'active' &&
    !expiredByDate;
  const hasLegacyMetadataAccess = shouldUseLegacyMetadataFallback(user, profile);
  const hasActiveProAccess = hasProfileProAccess || hasLegacyMetadataAccess;
  const effectivePlan = hasActiveProAccess ? 'pro' : 'basic';
  const freeFullInsightsRemaining = user && !hasActiveProAccess
    ? Math.max(0, 1 - freeFullInsightsUsedCount)
    : 0;

  return {
    effectivePlan,
    hasActiveProAccess,
    hasFreeFullInsightAvailable: Boolean(user) && freeFullInsightsRemaining > 0,
    freeFullInsightsRemaining,
    freeFullInsightsUsedCount,
    billingStatus: expiredProfile ? 'expired' : normalizedBillingStatus,
    planExpiresAt: normalizedPlanExpiresAt,
    isProExpired: expiredProfile,
  };
}

module.exports = {
  normalizeBillingStatus,
  normalizeFreeInsightsCount,
  normalizePlanExpiresAt,
  resolveUserAccessState,
};
