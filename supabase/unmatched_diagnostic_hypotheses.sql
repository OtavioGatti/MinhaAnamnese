-- Backlog editorial de prescrições: hipóteses diagnósticas geradas pela IA que
-- NÃO encontraram um guia de prescrição correspondente. Serve para priorizar
-- quais protocolos escrever primeiro (os que mais aparecem na prática).
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.unmatched_diagnostic_hypotheses (
  normalized_name text primary key,
  display_name text not null,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  notes text
);

alter table public.unmatched_diagnostic_hypotheses enable row level security;

-- Sem policies: apenas o service role (que ignora RLS) acessa esta tabela.

-- Fila de trabalho: o que mais aparece e ainda não foi resolvido vem primeiro.
create index if not exists unmatched_diagnostic_hypotheses_backlog_idx
  on public.unmatched_diagnostic_hypotheses (occurrences desc, last_seen_at desc)
  where resolved_at is null;

-- Incremento atômico: o PostgREST sozinho substituiria a linha em vez de somar.
create or replace function public.record_unmatched_hypothesis(
  p_normalized_name text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if coalesce(trim(p_normalized_name), '') = '' then
    return;
  end if;

  insert into public.unmatched_diagnostic_hypotheses as backlog (
    normalized_name, display_name, occurrences, first_seen_at, last_seen_at
  )
  values (p_normalized_name, coalesce(nullif(trim(p_display_name), ''), p_normalized_name), 1, v_now, v_now)
  on conflict (normalized_name) do update
    set occurrences = backlog.occurrences + 1,
        last_seen_at = v_now,
        display_name = excluded.display_name;
end;
$$;

revoke all on function public.record_unmatched_hypothesis(text, text) from public;
revoke all on function public.record_unmatched_hypothesis(text, text) from anon;
revoke all on function public.record_unmatched_hypothesis(text, text) from authenticated;
grant execute on function public.record_unmatched_hypothesis(text, text) to service_role;

-- Consulta útil para o dono:
--   select display_name, occurrences, last_seen_at
--   from public.unmatched_diagnostic_hypotheses
--   where resolved_at is null
--   order by occurrences desc, last_seen_at desc;
