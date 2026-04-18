function isValidUserId(userId) {
  return typeof userId === 'string' && /^[0-9a-fA-F-]{36}$/.test(userId);
}

async function registerAnamneseMetric({ userId, template, score, textLength, hasTeaser }) {
  if (!isValidUserId(userId)) {
    return;
  }

  if (typeof score !== 'number' || Number.isNaN(score)) {
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/anamneses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      template,
      score,
      text_length: textLength,
      has_teaser: Boolean(hasTeaser),
    }),
  });

  if (!response.ok) {
    throw new Error('failed to insert anamnese metric');
  }
}

module.exports = {
  isValidUserId,
  registerAnamneseMetric,
};
