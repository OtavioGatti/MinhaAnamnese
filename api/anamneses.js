const {
  getAnamneseActivity,
  getAnamneseStats,
  getCurrentStreakFromActivityDates,
  listRecentAnamneseMetrics,
} = require('../backend/services/anamneseMetrics');
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');

function getEmptyStats() {
  return {
    total_anamneses: 0,
    score_medio: null,
    melhor_score: null,
    ultimo_score: null,
    score_anterior: null,
  };
}

function getEmptyStreak() {
  return {
    current_streak: 0,
    last_active_date: null,
  };
}

function getViewFromRequest(req) {
  const view = String(req.query?.view || '').trim().toLowerCase();
  return view || 'recent';
}

async function getDataByView(view, userId) {
  switch (view) {
    case 'stats':
      return getAnamneseStats(userId);
    case 'activity':
      return getAnamneseActivity(userId);
    case 'streak': {
      const activityDates = await getAnamneseActivity(userId);
      return getCurrentStreakFromActivityDates(activityDates);
    }
    case 'recent':
    default:
      return listRecentAnamneseMetrics(userId);
  }
}

function getFallbackDataByView(view) {
  switch (view) {
    case 'stats':
      return getEmptyStats();
    case 'activity':
      return [];
    case 'streak':
      return getEmptyStreak();
    case 'recent':
    default:
      return [];
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'M\u00e9todo n\u00e3o permitido',
    });
  }

  const view = getViewFromRequest(req);

  try {
    const auth = await resolveSupabaseUser(req);

    if (!auth.user) {
      return res.status(auth.statusCode).json({
        success: false,
        error: auth.error,
      });
    }

    const data = await getDataByView(view, auth.user.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (_error) {
    return res.status(200).json({
      success: true,
      data: getFallbackDataByView(view),
    });
  }
};
