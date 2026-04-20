const { isValidUserId } = require('../utils/idValidation');

function getSupabaseAdminConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    serviceRoleKey,
  };
}

async function registerAnamneseMetric({ userId, template, score, textLength, hasTeaser }) {
  if (!isValidUserId(userId)) {
    return;
  }

  if (typeof score !== 'number' || Number.isNaN(score)) {
    return;
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return;
  }

  const response = await fetch(`${url}/rest/v1/anamneses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      template,
      score,
      text_length: textLength,
      has_teaser: Boolean(hasTeaser),
    }),
  });

  if (!response.ok) {
    throw new Error('failed to insert anamnese metric');
  }
}

async function listRecentAnamneseMetrics(userId) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,template,score,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: '20',
  });

  const response = await fetch(`${url}/rest/v1/anamneses?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch anamneses');
  }

  const json = await response.json();

  if (!Array.isArray(json)) {
    return [];
  }

  return json.filter((item) => (
    item &&
    typeof item.id === 'string' &&
    typeof item.template === 'string' &&
    typeof item.score === 'number' &&
    typeof item.created_at === 'string'
  ));
}

async function getAnamneseStats(userId) {
  const anamneses = await listRecentAnamneseMetrics(userId);

  if (!anamneses.length) {
    return {
      total_anamneses: 0,
      score_medio: null,
      melhor_score: null,
      ultimo_score: null,
      score_anterior: null,
    };
  }

  const scores = anamneses
    .map((item) => item.score)
    .filter((score) => typeof score === 'number' && !Number.isNaN(score));

  if (!scores.length) {
    return {
      total_anamneses: 0,
      score_medio: null,
      melhor_score: null,
      ultimo_score: null,
      score_anterior: null,
    };
  }

  const total = scores.length;
  const scoreMedio = scores.reduce((sum, score) => sum + score, 0) / total;

  return {
    total_anamneses: total,
    score_medio: Number(scoreMedio.toFixed(1)),
    melhor_score: Math.max(...scores),
    ultimo_score: scores[0] ?? null,
    score_anterior: scores[1] ?? null,
  };
}

async function getAnamneseActivity(userId) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
  });

  const response = await fetch(`${url}/rest/v1/anamneses?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch anamneses activity');
  }

  const json = await response.json();

  if (!Array.isArray(json)) {
    return [];
  }

  const uniqueDates = Array.from(
    new Set(
      json
        .map((item) => (typeof item?.created_at === 'string' ? item.created_at.slice(0, 10) : null))
        .filter(Boolean)
    )
  );

  return uniqueDates.sort((left, right) => left.localeCompare(right));
}

function getCurrentStreakFromActivityDates(activityDates) {
  if (!Array.isArray(activityDates) || activityDates.length === 0) {
    return {
      current_streak: 0,
      last_active_date: null,
    };
  }

  const sortedDates = [...activityDates].sort((left, right) => right.localeCompare(left));
  const lastActiveDate = sortedDates[0] || null;

  if (!lastActiveDate) {
    return {
      current_streak: 0,
      last_active_date: null,
    };
  }

  let currentStreak = 1;
  let previousDate = new Date(`${lastActiveDate}T00:00:00.000Z`);

  for (let index = 1; index < sortedDates.length; index += 1) {
    const currentDate = new Date(`${sortedDates[index]}T00:00:00.000Z`);

    if (Number.isNaN(currentDate.getTime())) {
      break;
    }

    const diffInDays = Math.round((previousDate.getTime() - currentDate.getTime()) / 86400000);

    if (diffInDays !== 1) {
      break;
    }

    currentStreak += 1;
    previousDate = currentDate;
  }

  return {
    current_streak: currentStreak,
    last_active_date: lastActiveDate,
  };
}

module.exports = {
  getCurrentStreakFromActivityDates,
  getAnamneseActivity,
  getAnamneseStats,
  listRecentAnamneseMetrics,
  registerAnamneseMetric,
};
