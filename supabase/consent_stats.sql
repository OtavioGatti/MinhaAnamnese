-- Contagem anônima do banner de cookies do Minha Anamnese.
--
-- Cada linha é um contador por dia × evento × origem × dispositivo × navegador
-- interno. Não existe coluna para IP, user agent, id de usuário, sessão, cookie
-- nem horário: o navegador manda só quatro palavras de uma lista fechada e o
-- banco soma +1 na linha do dia. Por isso a contagem pode rodar antes da
-- resposta do banner (LGPD, art. 12: dado anonimizado não é dado pessoal).
--
-- Idempotente. Atenção: neste projeto os default privileges de `public` dão ALL
-- ao anon/authenticated em tabela/view nova e EXECUTE em função nova
-- (conferido em 12/11/2026, Postgres 17.6). Os revokes abaixo não são opcionais.

create table if not exists public.consent_stats (
  dia date not null,
  evento text not null check (evento in ('mostrado', 'aceitou', 'recusou')),
  origem text not null check (origem in ('meta', 'google', 'organico', 'outro')),
  dispositivo text not null check (dispositivo in ('celular', 'desktop')),
  navegador_interno text not null check (navegador_interno in ('instagram', 'facebook', 'tiktok', 'nenhum')),
  quantidade integer not null default 0 check (quantidade >= 0),
  primary key (dia, evento, origem, dispositivo, navegador_interno)
);

alter table public.consent_stats enable row level security;
-- Sem policy de propósito: pelo front ninguém lê nem escreve na tabela.
revoke all on table public.consent_stats from public, anon, authenticated;

create or replace function public.consent_stats_increment(
  p_evento text,
  p_origem text,
  p_dispositivo text,
  p_navegador_interno text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fora da lista fechada: ignora sem erro (a função não vira canal de texto livre).
  if coalesce(p_evento, '') not in ('mostrado', 'aceitou', 'recusou')
    or coalesce(p_origem, '') not in ('meta', 'google', 'organico', 'outro')
    or coalesce(p_dispositivo, '') not in ('celular', 'desktop')
    or coalesce(p_navegador_interno, '') not in ('instagram', 'facebook', 'tiktok', 'nenhum')
  then
    return;
  end if;

  insert into public.consent_stats as s
    (dia, evento, origem, dispositivo, navegador_interno, quantidade)
  values
    ((now() at time zone 'America/Sao_Paulo')::date, p_evento, p_origem, p_dispositivo, p_navegador_interno, 1)
  on conflict (dia, evento, origem, dispositivo, navegador_interno)
  do update set quantidade = s.quantidade + 1
  -- Teto por linha e por dia: a chave anon é pública e alguém pode chamar a
  -- função em loop. O teto limita o estrago àquele dia e àquela combinação.
  where s.quantidade < 5000;
end;
$$;

revoke all on function public.consent_stats_increment(text, text, text, text) from public, anon, authenticated;
grant execute on function public.consent_stats_increment(text, text, text, text) to anon;

create or replace view public.v_consent_resumo
with (security_invoker = true)
as
select
  dia,
  origem,
  dispositivo,
  navegador_interno,
  coalesce(sum(quantidade) filter (where evento = 'mostrado'), 0) as mostrado,
  coalesce(sum(quantidade) filter (where evento = 'aceitou'), 0) as aceitou,
  coalesce(sum(quantidade) filter (where evento = 'recusou'), 0) as recusou,
  greatest(
    coalesce(sum(quantidade) filter (where evento = 'mostrado'), 0)
    - coalesce(sum(quantidade) filter (where evento in ('aceitou', 'recusou')), 0),
    0
  ) as sem_resposta,
  round(100.0 * coalesce(sum(quantidade) filter (where evento = 'aceitou'), 0)
        / nullif(sum(quantidade) filter (where evento = 'mostrado'), 0), 1) as taxa_aceite_pct,
  round(100.0 * coalesce(sum(quantidade) filter (where evento = 'recusou'), 0)
        / nullif(sum(quantidade) filter (where evento = 'mostrado'), 0), 1) as taxa_recusa_pct
from public.consent_stats
group by dia, origem, dispositivo, navegador_interno;

-- security_invoker já faria a view respeitar o revoke da tabela; o revoke da
-- view fecha a porta de novo caso alguém troque a opção no futuro.
revoke all on table public.v_consent_resumo from public, anon, authenticated;

-- Conferência depois de aplicar (esperado: false, false, false, true, false):
-- select has_table_privilege('anon', 'public.consent_stats', 'select') as anon_le_tabela,
--        has_table_privilege('anon', 'public.consent_stats', 'insert') as anon_escreve_tabela,
--        has_table_privilege('anon', 'public.v_consent_resumo', 'select') as anon_le_view,
--        has_function_privilege('anon', 'public.consent_stats_increment(text,text,text,text)', 'execute') as anon_executa,
--        has_function_privilege('authenticated', 'public.consent_stats_increment(text,text,text,text)', 'execute') as logado_executa;
