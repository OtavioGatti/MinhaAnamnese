// De onde veio a visita: canal (tiktok, instagram…) e os parâmetros utm_ do
// link. Só o domínio de origem e os utm — nunca a página exata nem nada da
// pessoa. Lógica pura, testada em backend/tests/trafficOrigin.test.js.
//
// Ordem de decisão:
// 1. utm_source do link (o mais confiável: o criador controla);
// 2. navegador interno do app (TikTok e Instagram costumam esconder o
//    referrer, mas se identificam no user agent);
// 3. domínio de onde a pessoa veio;
// 4. ?ref= de afiliado;
// 5. "direto".

export const ORIGIN_STORAGE_KEY = 'minha-anamnese:origem';
// Uma visita com canal conhecido vale por 30 dias: quem chega pelo TikTok e
// se cadastra dias depois, digitando o endereço, continua atribuído ao TikTok.
const ORIGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SOURCE_ALIASES = [
  [/^(tiktok|tt|tik_tok|tik-tok)$/, 'tiktok'],
  [/^(instagram|ig|insta)$/, 'instagram'],
  [/^(facebook|fb|meta)$/, 'facebook'],
  [/^(whatsapp|wa|zap|whats)$/, 'whatsapp'],
  [/^(google|gads|adwords)$/, 'google'],
  [/^(youtube|yt)$/, 'youtube'],
];

const HOST_CHANNELS = [
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com|messenger\.com)$/, 'facebook'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|search\.yahoo\.com)$/, 'busca'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'twitter'],
  [/(^|\.)linktr\.ee$/, 'linktree'],
];

function clean(value, max = 60) {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, max);
  return text || null;
}

function normalizeSource(source) {
  const value = clean(source);
  if (!value) {
    return null;
  }

  for (const [pattern, canal] of SOURCE_ALIASES) {
    if (pattern.test(value)) {
      return canal;
    }
  }

  return value;
}

function channelFromUserAgent(userAgent) {
  const ua = String(userAgent || '');
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) {
    return 'tiktok';
  }
  if (/Instagram/i.test(ua)) {
    return 'instagram';
  }
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) {
    return 'facebook';
  }
  return null;
}

function referrerHost(referrer, ownHost) {
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || (ownHost && host === String(ownHost).toLowerCase().replace(/^www\./, ''))) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function classifyTrafficOrigin({ search = '', referrer = '', userAgent = '', ownHost = '' } = {}) {
  const params = new URLSearchParams(search);
  const utmSource = normalizeSource(params.get('utm_source'));
  const utmCampaign = clean(params.get('utm_campaign'));
  const host = referrerHost(referrer, ownHost);
  const appChannel = channelFromUserAgent(userAgent);
  let canal = utmSource || appChannel;

  if (!canal && host) {
    canal = HOST_CHANNELS.find(([pattern]) => pattern.test(host))?.[1] || 'outro';
  }

  if (!canal && params.get('ref')) {
    canal = 'afiliado';
  }

  return {
    canal: canal || 'direto',
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    ref_host: host,
  };
}

// Última origem conhecida: uma visita "direta" não apaga a origem anterior
// (dentro de 30 dias); uma visita com canal novo substitui.
export function resolveStoredOrigin({ current, stored, now = Date.now() }) {
  const anterior = stored && typeof stored === 'object' ? stored : null;
  const anteriorValida = anterior && Number(anterior.ts) > 0 && now - Number(anterior.ts) < ORIGIN_TTL_MS;

  if (current.canal === 'direto' && anteriorValida) {
    return anterior;
  }

  return { ...current, ts: now };
}

export function parseStoredOrigin(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.canal ? parsed : null;
  } catch {
    return null;
  }
}
