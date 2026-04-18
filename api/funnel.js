const { isValidUserId, getFunnelSessions } = require('./_funnel');

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
      data: [],
    });
  }

  try {
    const funnelSessions = await getFunnelSessions(userId);

    return res.status(200).json({
      success: true,
      data: funnelSessions,
    });
  } catch (error) {
    console.error('funnel: failed to classify sessions', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao classificar funil',
    });
  }
};
