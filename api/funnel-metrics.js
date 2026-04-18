const { FUNNEL_STEPS, isValidUserId, getFunnelSessions } = require('./_funnel');

function getZeroMetrics() {
  return {
    total_sessoes: 0,
    etapas: FUNNEL_STEPS.map((eventName, index) => ({
      etapa: index + 1,
      event_name: eventName,
      sessoes: 0,
      taxa_conversao: 0,
    })),
  };
}

function getConversionRate(currentCount, previousCount) {
  if (!previousCount) {
    return 0;
  }

  return Number(((currentCount / previousCount) * 100).toFixed(1));
}

function buildFunnelMetrics(funnelSessions) {
  if (!Array.isArray(funnelSessions) || funnelSessions.length === 0) {
    return getZeroMetrics();
  }

  const totalSessions = funnelSessions.length;
  const stageCounts = FUNNEL_STEPS.map((_, index) => (
    funnelSessions.filter((session) => session.funnel_level >= index + 1).length
  ));

  return {
    total_sessoes: totalSessions,
    etapas: FUNNEL_STEPS.map((eventName, index) => ({
      etapa: index + 1,
      event_name: eventName,
      sessoes: stageCounts[index],
      taxa_conversao: index === 0
        ? getConversionRate(stageCounts[index], totalSessions)
        : getConversionRate(stageCounts[index], stageCounts[index - 1]),
    })),
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
    const metrics = buildFunnelMetrics(funnelSessions);

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('funnel-metrics: failed to calculate metrics', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao calcular metricas do funil',
    });
  }
};
