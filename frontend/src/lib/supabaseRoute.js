// Caminho do navegador até o Supabase (login, cadastro, sessão).
//
// Em 22/09/2026 a Alares (Cabo Telecom) passou a bloquear faixas de IP da
// Cloudflare — padrão de bloqueio judicial de sites piratas, que derruba junto
// quem divide o mesmo IP — e os dois endereços do nosso Supabase caíram nelas:
// quem usa essa operadora não entrava nem criava conta, sem erro nenhum na tela.
//
// O navegador testa o caminho direto ao abrir o site. Bloqueado, passa a falar
// com o Supabase pelo nosso domínio (/sb, repassado pela Vercel, que não está na
// Cloudflare). Quem não está bloqueado continua direto: o Supabase limita login
// e cadastro por IP, e pela Vercel todos dividiriam o mesmo limite.
//
// Lógica pura aqui (testada pelo backend); a rede fica em supabaseClient.js.

export const SUPABASE_PROXY_PATH = '/sb';
export const SUPABASE_ROUTE_KEY = 'minha-anamnese:rota-supabase';
// Só o desvio fica guardado, e por pouco tempo: a pessoa pode trocar de rede
// (celular saindo do Wi-Fi) ou a operadora pode desfazer o bloqueio.
export const SUPABASE_ROUTE_TTL_MS = 12 * 60 * 60 * 1000;
// Endereço bloqueado não recusa: fica sem resposta até o navegador desistir.
export const SUPABASE_PROBE_TIMEOUT_MS = 4000;

/** Troca o endereço do Supabase pelo atalho no nosso domínio. Outros endereços passam intactos. */
export function toProxyUrl(url, { supabaseUrl, origin }) {
  const texto = String(url);
  const base = String(supabaseUrl || '').replace(/\/+$/, '');

  if (!base || !origin || (texto !== base && !texto.startsWith(`${base}/`))) {
    return texto;
  }

  return `${String(origin).replace(/\/+$/, '')}${SUPABASE_PROXY_PATH}${texto.slice(base.length)}`;
}

/** Rota guardada neste navegador, se ainda valer. Só o desvio é guardado. */
export function readStoredRoute(raw, now = Date.now()) {
  try {
    const guardado = JSON.parse(raw);

    if (guardado?.rota === 'proxy' && Number.isFinite(guardado.em) && now - guardado.em < SUPABASE_ROUTE_TTL_MS) {
      return 'proxy';
    }
  } catch {
    // Valor corrompido ou ausente: decide de novo.
  }

  return null;
}

export function serializeStoredRoute(now = Date.now()) {
  return JSON.stringify({ rota: 'proxy', em: now });
}

/**
 * O atalho respondeu mesmo pelo Supabase? Sem a regra de repasse, a Vercel
 * devolve a página do site (HTML, 200) e o desvio levaria a um caminho quebrado.
 */
export function isSupabaseHealthResponse({ ok, contentType, body }) {
  return Boolean(ok)
    && String(contentType || '').includes('application/json')
    && /gotrue/i.test(String(body || ''));
}
