const { isValidUserId, getFunnelSessions } = require('./_funnel');
const { buildFunnelMetrics, getZeroFunnelMetrics } = require('../backend/services/funnelMetrics');

function toLegacyMetricsShape(metrics) {
  return {
    total_sessoes: metrics.total_sessoes,
    etapas: metrics.etapas.map((etapa) => ({
      etapa: etapa.etapa,
      event_name: etapa.nome,
      sessoes: etapa.total,
      taxa_conversao: etapa.taxa_conversao,
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
      data: toLegacyMetricsShape(getZeroFunnelMetrics()),
    });
  }

  try {
    const funnelSessions = await getFunnelSessions(userId);
    const metrics = toLegacyMetricsShape(buildFunnelMetrics(funnelSessions));

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
