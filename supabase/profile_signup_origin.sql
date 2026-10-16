-- Canal de origem do cadastro (tiktok, instagram, google, direto…) e a
-- campanha (utm_campaign ou utm_source do link). Gravados uma vez, no primeiro
-- perfil, a partir do que o site manda no signUp (frontend/src/lib/trafficOrigin.js).
-- Idempotente. Leitura protegida pela RLS de profiles (cada um vê a própria linha).

alter table public.profiles
  add column if not exists signup_origin text,
  add column if not exists signup_campaign text;

-- Conferência:
--   select signup_origin, count(*) from public.profiles group by 1 order by 2 desc;
