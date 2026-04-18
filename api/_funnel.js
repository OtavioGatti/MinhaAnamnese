const FUNNEL_STEPS = [
  'anamnese_gerada',
  'score_exibido',
  'cta_avaliacao_click',
  'insight_gerado',
  'upgrade_click',
];

function isValidUserId(userId) {
  return typeof userId === 'string' && /^[0-9a-fA-F-]{36}$/.test(userId);
}

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[0-9a-fA-F-]{36}$/.test(sessionId);
}

function sortEventsAsc(events) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return 0;
    }

    if (Number.isNaN(leftTime)) {
      return 1;
    }

    if (Number.isNaN(rightTime)) {
      return -1;
    }

    return leftTime - rightTime;
  });
}

function deduplicateEvents(events) {
  const seen = new Set();

  return sortEventsAsc(events).filter((event) => {
    if (seen.has(event.event_name)) {
      return false;
    }

    seen.add(event.event_name);
    return true;
  });
}

function getFunnelLevel(events) {
  const uniqueOrderedEvents = deduplicateEvents(events);
  let nextStepIndex = 0;
  let level = 0;

  for (const event of uniqueOrderedEvents) {
    const expectedStep = FUNNEL_STEPS[nextStepIndex];

    if (!expectedStep) {
      break;
    }

    if (event.event_name !== expectedStep) {
      continue;
    }

    level += 1;
    nextStepIndex += 1;
  }

  return {
    funnel_level: level,
    steps_completed: FUNNEL_STEPS.slice(0, level),
    next_step: FUNNEL_STEPS[level] || null,
  };
}

async function fetchEventsByUserId(userId) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase not configured');
  }

  const query = new URLSearchParams({
    select: 'session_id,event_name,created_at',
    user_id: `eq.${userId}`,
    order: 'created_at.asc',
    event_name: `in.(${FUNNEL_STEPS.join(',')})`,
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/events?${query.toString()}`, {
    method: 'GET',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('failed to fetch events');
  }

  const json = await response.json();

  if (!Array.isArray(json)) {
    return [];
  }

  return json.filter((event) => (
    isValidSessionId(event?.session_id) &&
    typeof event?.event_name === 'string' &&
    FUNNEL_STEPS.includes(event.event_name) &&
    typeof event?.created_at === 'string'
  ));
}

async function getFunnelSessions(userId) {
  const events = await fetchEventsByUserId(userId);
  const sessionsMap = new Map();

  events.forEach((event) => {
    const sessionEvents = sessionsMap.get(event.session_id) || [];
    sessionEvents.push(event);
    sessionsMap.set(event.session_id, sessionEvents);
  });

  return Array.from(sessionsMap.entries())
    .map(([sessionId, sessionEvents]) => {
      const orderedEvents = sortEventsAsc(sessionEvents);
      const funnel = getFunnelLevel(orderedEvents);

      return {
        session_id: sessionId,
        funnel_level: funnel.funnel_level,
        steps_completed: funnel.steps_completed,
        next_step: funnel.next_step,
        created_at: orderedEvents[0]?.created_at || null,
        last_event_at: orderedEvents[orderedEvents.length - 1]?.created_at || null,
      };
    })
    .sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      return rightTime - leftTime;
    });
}

module.exports = {
  FUNNEL_STEPS,
  isValidUserId,
  getFunnelSessions,
};
