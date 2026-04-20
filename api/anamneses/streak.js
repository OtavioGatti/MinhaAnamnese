const {
  getAnamneseActivity,
  getCurrentStreakFromActivityDates,
} = require('../../backend/services/anamneseMetrics');
const { isValidUserId } = require('../../backend/utils/idValidation');

function getEmptyStreak() {
  return {
    current_streak: 0,
    last_active_date: null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

  const userId = req.query?.userId;

  if (!isValidUserId(userId)) {
    return res.status(200).json({
      success: true,
      data: getEmptyStreak(),
    });
  }

  try {
    const activityDates = await getAnamneseActivity(userId);

    return res.status(200).json({
      success: true,
      data: getCurrentStreakFromActivityDates(activityDates),
    });
  } catch (_error) {
    return res.status(200).json({
      success: true,
      data: getEmptyStreak(),
    });
  }
};
