const { FUNNEL_STEPS } = require('../utils/funnel');

function getConversionRate(currentCount, previousCount) {
  if (!previousCount) {
    return 0;
  }

  return Number(((currentCount / previousCount) * 100).toFixed(1));
}

function getZeroFunnelMetrics() {
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

function buildFunnelMetrics(funnelSessions) {
  if (!Array.isArray(funnelSessions) || funnelSessions.length === 0) {
    return getZeroFunnelMetrics();
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

module.exports = {
  buildFunnelMetrics,
  getZeroFunnelMetrics,
};
