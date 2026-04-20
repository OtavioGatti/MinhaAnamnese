const { isValidUserId, getFunnelSessions } = require('../_funnel');
const { buildFunnelMetrics, getZeroFunnelMetrics } = require('../../backend/services/funnelMetrics');

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
      data: getZeroFunnelMetrics(),
    });
  }

  try {
    const funnelSessions = await getFunnelSessions(userId);

    return res.status(200).json({
      success: true,
      data: buildFunnelMetrics(funnelSessions),
    });
  } catch (error) {
    console.error('metrics/funnel: failed to calculate metrics', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao calcular metricas do funil',
    });
  }
};
