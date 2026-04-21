const { buildFunnelMetrics, getZeroFunnelMetrics } = require('../backend/services/funnelMetrics');
const { getFunnelSessions } = require('../backend/services/funnelTracking');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../backend/utils/supabaseAuth');
const { isValidSessionId } = require('../backend/utils/idValidation');

const ALLOWED_EVENTS = new Set([
  'anamnese_gerada',
  'score_exibido',
  'teaser_exibido',
  'cta_avaliacao_click',
  'insight_gerado',
  'upgrade_click',
]);
const DEBUG_ANALYTICS = process.env.DEBUG_ANALYTICS === 'true';

function logAnalyticsDebug(message, context = {}) {
  if (!DEBUG_ANALYTICS) {
    return;
  }

  console.error('analytics:', message, context);
}

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
  const { eventName, metadata } = req.body || {};
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
    return res.status(503).json({
      success: false,
      error: 'Analytics indisponível no servidor no momento.',
    });
  }

  try {
    let authenticatedUserId = null;
    const accessToken = getAccessTokenFromRequest(req);

    if (accessToken) {
      const auth = await resolveSupabaseUser(req);

      if (!auth.user) {
        return res.status(auth.statusCode).json({
          success: false,
          error: auth.error,
        });
      }

      authenticatedUserId = auth.user.id;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: authenticatedUserId,
        session_id: sessionId,
        event_name: eventName,
        metadata: sanitizeMetadata(metadata),
      }),
    });

    if (!response.ok) {
      logAnalyticsDebug('failed to insert event', {
        status: response.status,
        eventName,
        hasAuthenticatedUser: Boolean(authenticatedUserId),
      });

      return res.status(503).json({
        success: false,
        error: 'Não foi possível registrar o evento no momento.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        scope: authenticatedUserId ? 'authenticated' : 'anonymous',
      },
    });
  } catch (error) {
    logAnalyticsDebug('failed to track event', {
      eventName,
      message: error?.message || 'unknown_error',
    });

    return res.status(503).json({
      success: false,
      error: 'Não foi possível registrar o evento no momento.',
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
      logAnalyticsDebug('failed to resolve funnel data', {
        message: error?.message || 'unknown_error',
      });

      return res.status(503).json({
        success: false,
        error: 'Não foi possível carregar as métricas do funil no momento.',
        data: getZeroFunnelMetrics(),
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Metodo nao permitido',
  });
};
