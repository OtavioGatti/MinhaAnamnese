const { buildFunnelMetrics, getZeroFunnelMetrics } = require('../backend/services/funnelMetrics');
const { getFunnelSessions } = require('../backend/services/funnelTracking');
const { resolveSupabaseUser } = require('../backend/utils/supabaseAuth');
const { isValidSessionId, isValidUserId } = require('../backend/utils/idValidation');

const ALLOWED_EVENTS = new Set([
  'anamnese_gerada',
  'score_exibido',
  'teaser_exibido',
  'cta_avaliacao_click',
  'insight_gerado',
  'upgrade_click',
]);

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const sanitized = {};
  const allowedKeys = ['template', 'text_length', 'score', 'is_pro', 'has_teaser'];

  allowedKeys.forEach((key) => {
    const value = metadata[key];

    if (value === undefined || value === null) {
      return;
    }

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 120);
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  });

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

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

function getAnalyticsView(req) {
  return String(req.query?.view || '').trim().toLowerCase() || 'funnelmetrics';
}

async function handleTrackEvent(req, res) {
  const { userId, eventName, metadata } = req.body || {};
  const sessionId = metadata?.session_id;

  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({
      success: false,
      error: 'Evento invalido',
    });
  }

  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Session ID invalido',
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(200).json({
      success: true,
      skipped: true,
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: isValidUserId(userId) ? userId : null,
        session_id: sessionId,
        event_name: eventName,
        metadata: sanitizeMetadata(metadata),
      }),
    });

    if (!response.ok) {
      throw new Error('failed to insert event');
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('analytics: failed to track event', error);
    return res.status(200).json({
      success: true,
      skipped: true,
    });
  }
}

async function handleAnalyticsRead(req, res) {
  const auth = await resolveSupabaseUser(req);

  if (!auth.user) {
    return res.status(auth.statusCode).json({
      success: false,
      error: auth.error,
    });
  }

  const funnelSessions = await getFunnelSessions(auth.user.id);
  const metrics = buildFunnelMetrics(funnelSessions);
  const view = getAnalyticsView(req);

  if (view === 'funnelsessions') {
    return res.status(200).json({
      success: true,
      data: funnelSessions,
    });
  }

  if (view === 'funnellegacy') {
    return res.status(200).json({
      success: true,
      data: toLegacyMetricsShape(metrics),
    });
  }

  return res.status(200).json({
    success: true,
    data: metrics || getZeroFunnelMetrics(),
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    return handleTrackEvent(req, res);
  }

  if (req.method === 'GET') {
    try {
      return await handleAnalyticsRead(req, res);
    } catch (error) {
      console.error('analytics: failed to resolve funnel data', error);
      return res.status(200).json({
        success: true,
        data: getZeroFunnelMetrics(),
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Metodo nao permitido',
  });
};
