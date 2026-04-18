const { FUNNEL_STEPS, isValidUserId, getFunnelSessions } = require('../_funnel');

function getConversionRate(currentCount, previousCount) {
  if (!previousCount) {
    return 0;
  }

  return Number(((currentCount / previousCount) * 100).toFixed(1));
}

function getZeroMetrics() {
  return {
    total_sessoes: 0,
    etapas: FUNNEL_STEPS.map((eventName, index) => ({
      nome: eventName,
      total: 0,
      taxa_conversao: 0,
      queda: 0,
      etapa: index + 1,
    })),
  };
}

function buildMetricsResponse(funnelSessions) {
  if (!Array.isArray(funnelSessions) || funnelSessions.length === 0) {
    return getZeroMetrics();
  }

  const totalSessoes = funnelSessions.length;
  const stageCounts = FUNNEL_STEPS.map((_, index) => (
    funnelSessions.filter((session) => session.funnel_level >= index + 1).length
  ));

  return {
    total_sessoes: totalSessoes,
    etapas: FUNNEL_STEPS.map((eventName, index) => {
      const total = stageCounts[index];
      const previousTotal = index === 0 ? totalSessoes : stageCounts[index - 1];

      return {
        nome: eventName,
        total,
        taxa_conversao: getConversionRate(total, previousTotal),
        queda: index === 0 ? 0 : Math.max(previousTotal - total, 0),
        etapa: index + 1,
      };
    }),
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
      data: getZeroMetrics(),
    });
  }

  try {
    const funnelSessions = await getFunnelSessions(userId);

    return res.status(200).json({
      success: true,
      data: buildMetricsResponse(funnelSessions),
    });
  } catch (error) {
    console.error('metrics/funnel: failed to calculate metrics', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao calcular metricas do funil',
    });
  }
};
