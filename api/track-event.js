const ALLOWED_EVENTS = new Set([
  'anamnese_gerada',
  'score_exibido',
  'teaser_exibido',
  'cta_avaliacao_click',
  'insight_gerado',
  'upgrade_click',
]);
const SESSION_ID_REGEX = /^[0-9a-fA-F-]{36}$/;

function isValidUserId(userId) {
  return typeof userId === 'string' && /^[0-9a-fA-F-]{36}$/.test(userId);
}

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && SESSION_ID_REGEX.test(sessionId);
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo nao permitido',
    });
  }

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
    return res.status(500).json({
      success: false,
      error: 'Supabase nao configurado',
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
    console.error('events: failed to track event', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao registrar evento',
    });
  }
};
