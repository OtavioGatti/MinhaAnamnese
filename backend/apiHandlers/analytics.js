const { buildFunnelMetrics, getZeroFunnelMetrics } = require('../services/funnelMetrics');
const { getFunnelSessions } = require('../services/funnelTracking');
const {
  getAccessTokenFromRequest,
  resolveSupabaseUser,
} = require('../utils/supabaseAuth');
const { isValidSessionId } = require('../utils/idValidation');

// Precisa acompanhar o que o frontend realmente dispara (trackEvent em
// App.jsx). Evento fora desta lista volta 400 e some sem deixar rastro: o
// cliente engole o erro, então a métrica simplesmente não existe e ninguém
// percebe. Foi o que aconteceu com cartas, hipóteses e onboarding.
const ALLOWED_EVENTS = new Set([
  // Fluxo principal
  'anamnese_gerada',
  'score_exibido',
  'teaser_exibido',
  'cta_avaliacao_click',
  'insight_gerado',
  'upgrade_click',
  // Cartas e documentos
  'carta_gerada',
  'carta_copiada',
  // Hipóteses diagnósticas e o que elas levam a abrir
  'hipoteses_diagnosticas_geradas',
  'hipoteses_raciocinio_completo_click',
  'ferramenta_vinculada_click',
  'hipotese_manobra_click',
  'hipotese_exame_click',
  'hipotese_prescricao_click',
  // Chegada ao site: a unica etapa que nao exige acao do usuario
  'site_visita',
  // Origem: chegada por link de afiliado (topo do funil)
  'afiliado_link_visita',
  // Boas-vindas
  'onboarding_exibido',
  'onboarding_fechado',
  'onboarding_cta_click',
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
  // Allowlist também na metadata: só entra o que é métrica, nunca texto
  // clínico. Chave não listada é descartada em silêncio — por isso ela precisa
  // acompanhar os eventos acima, senão o evento chega vazio de contexto.
  const allowedKeys = [
    'template',
    'text_length',
    'score',
    'is_pro',
    'is_trial',
    'has_teaser',
    'plan_key',
    // Cartas
    'letter_type',
    'used_custom_model',
    'has_structured_result',
    // Hipóteses
    'hypothesis_count',
    'result_status',
    'prompt_source',
    'has_exact_guide',
    // Conteúdo do catálogo que foi aberto (identificador editorial, não dado
    // de paciente). `hypothesis` fica DE FORA de propósito: é o nome gerado a
    // partir da anamnese, o mais próximo de conteúdo clínico do paciente que
    // esses eventos carregam — `has_exact_guide` já dá o sinal útil.
    'slug',
    'origin',
    'maneuver',
    'exam',
    // Código do afiliado que trouxe a visita
    'ref',
    // Visita de quem ja tem conta vs visitante sem conta
    'logado',
  ];

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
      error: 'Evento inv\u00e1lido',
    });
  }

  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Session ID inv\u00e1lido',
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
    error: 'M\u00e9todo n\u00e3o permitido',
  });
};

// Anexados depois da atribuicao acima (que substitui module.exports inteiro).
// Servem ao teste que confere se a allowlist acompanha o que o frontend
// dispara — sem isso, um evento novo volta a ser descartado em silencio.
module.exports.ALLOWED_EVENTS = ALLOWED_EVENTS;
module.exports.sanitizeMetadata = sanitizeMetadata;
