const { isValidUserId } = require('../utils/idValidation');

const DEFAULT_ANALYSIS_ENGINE = 'unified_ai';
const LEGACY_ANALYSIS_ENGINE = 'legacy_structure';

function getSupabaseAdminConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    serviceRoleKey,
  };
}

function normalizeAnalysisEngine(value, fallback = DEFAULT_ANALYSIS_ENGINE) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || fallback;
}

function isMissingAnalysisEngineColumnError(responseText) {
  return /analysis_engine/i.test(responseText || '') && (
    /column/i.test(responseText || '') ||
    /schema cache/i.test(responseText || '') ||
    /pgrst204/i.test(responseText || '')
  );
}

async function fetchAnamneseJson(query, { allowEngineFallback = true } = {}) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return [];
  }

  const response = await fetch(`${url}/rest/v1/anamneses?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (response.ok) {
    const json = await response.json();
    return Array.isArray(json) ? json : [];
  }

  const responseText = await response.text().catch(() => '');

  if (allowEngineFallback && query.has('analysis_engine') && isMissingAnalysisEngineColumnError(responseText)) {
    const fallbackQuery = new URLSearchParams(query);
    fallbackQuery.delete('analysis_engine');
    return fetchAnamneseJson(fallbackQuery, { allowEngineFallback: false });
  }

  throw new Error('failed to fetch anamneses');
}

async function registerAnamneseMetric({
  userId,
  template,
  score,
  textLength,
  hasTeaser,
  analysisEngine = LEGACY_ANALYSIS_ENGINE,
}) {
  if (!isValidUserId(userId)) {
    return false;
  }

  if (typeof score !== 'number' || Number.isNaN(score)) {
    return false;
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  if (!url || !serviceRoleKey) {
    return false;
  }

  const payload = {
    user_id: userId,
    template,
    score,
    text_length: textLength,
    has_teaser: Boolean(hasTeaser),
    analysis_engine: normalizeAnalysisEngine(analysisEngine, LEGACY_ANALYSIS_ENGINE),
  };

  let response = await fetch(`${url}/rest/v1/anamneses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');

    if (isMissingAnalysisEngineColumnError(responseText)) {
      const { analysis_engine: _analysisEngine, ...fallbackPayload } = payload;

      response = await fetch(`${url}/rest/v1/anamneses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(fallbackPayload),
      });

      if (response.ok) {
        return true;
      }
    }

    throw new Error('failed to insert anamnese metric');
  }

  return true;
}

async function getLatestAnamneseMetric(userId, { analysisEngine = DEFAULT_ANALYSIS_ENGINE } = {}) {
  if (!isValidUserId(userId)) {
    return null;
  }

  const query = new URLSearchParams({
    select: 'id,template,score,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: '1',
  });

  if (analysisEngine) {
    query.set('analysis_engine', `eq.${normalizeAnalysisEngine(analysisEngine)}`);
  }

  const json = await fetchAnamneseJson(query);

  if (!Array.isArray(json) || !json[0]) {
    return null;
  }

  const item = json[0];

  if (
    !item ||
    typeof item.id !== 'string' ||
    typeof item.template !== 'string' ||
    typeof item.score !== 'number' ||
    typeof item.created_at !== 'string'
  ) {
    return null;
  }

  return item;
}

async function listRecentAnamneseMetrics(userId, { analysisEngine = DEFAULT_ANALYSIS_ENGINE } = {}) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'id,template,score,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.desc',
    limit: '20',
  });

  if (analysisEngine) {
    query.set('analysis_engine', `eq.${normalizeAnalysisEngine(analysisEngine)}`);
  }

  const json = await fetchAnamneseJson(query);

  return json.filter((item) => (
    item &&
    typeof item.id === 'string' &&
    typeof item.template === 'string' &&
    typeof item.score === 'number' &&
    typeof item.created_at === 'string'
  ));
}

async function listAnamneseScoresForStats(userId, { analysisEngine = DEFAULT_ANALYSIS_ENGINE } = {}) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const pageSize = 1000;
  const results = [];
  let offset = 0;

  while (true) {
    const query = new URLSearchParams({
      select: 'score,created_at',
      user_id: `eq.${userId}`,
      order: 'created_at.desc',
      limit: String(pageSize),
      offset: String(offset),
    });

    if (analysisEngine) {
      query.set('analysis_engine', `eq.${normalizeAnalysisEngine(analysisEngine)}`);
    }

    const json = await fetchAnamneseJson(query);

    if (!Array.isArray(json) || json.length === 0) {
      break;
    }

    results.push(
      ...json.filter((item) => (
        item &&
        typeof item.score === 'number' &&
        !Number.isNaN(item.score) &&
        typeof item.created_at === 'string'
      )),
    );

    if (json.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return results;
}

async function getAnamneseStats(userId, options = {}) {
  const anamneses = await listAnamneseScoresForStats(userId, options);

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

async function getAnamneseActivity(userId, { analysisEngine = DEFAULT_ANALYSIS_ENGINE } = {}) {
  if (!isValidUserId(userId)) {
    return [];
  }

  const query = new URLSearchParams({
    select: 'created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
  });

  if (analysisEngine) {
    query.set('analysis_engine', `eq.${normalizeAnalysisEngine(analysisEngine)}`);
  }

  const json = await fetchAnamneseJson(query);

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
  DEFAULT_ANALYSIS_ENGINE,
  LEGACY_ANALYSIS_ENGINE,
  getCurrentStreakFromActivityDates,
  getAnamneseActivity,
  getAnamneseStats,
  getLatestAnamneseMetric,
  listRecentAnamneseMetrics,
  registerAnamneseMetric,
};
