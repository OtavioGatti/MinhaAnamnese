-- Rate limiting persistente compartilhado entre instâncias do backend.
-- Sem esta tabela/função aplicada, o backend usa fallback em memória por processo.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

-- Sem policies: apenas o service role (que ignora RLS) acessa esta tabela.

create index if not exists rate_limit_buckets_reset_at_idx
  on public.rate_limit_buckets (reset_at);

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_bucket public.rate_limit_buckets%rowtype;
begin
  insert into public.rate_limit_buckets as buckets (bucket_key, request_count, reset_at, updated_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_ms / 1000.0), v_now)
  on conflict (bucket_key) do update
    set request_count = case
          when buckets.reset_at <= v_now then 1
          else buckets.request_count + 1
        end,
        reset_at = case
          when buckets.reset_at <= v_now then v_now + make_interval(secs => p_window_ms / 1000.0)
          else buckets.reset_at
        end,
        updated_at = v_now
  returning * into v_bucket;

  -- Limpeza oportunista de buckets expirados (~2% das chamadas).
  if random() < 0.02 then
    delete from public.rate_limit_buckets
    where reset_at < v_now - interval '1 day';
  end if;

  if v_bucket.request_count <= p_limit then
    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(p_limit - v_bucket.request_count, 0),
      'retry_after_seconds', 0
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_bucket.reset_at - v_now))))::integer
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, bigint) from public;
revoke all on function public.consume_rate_limit(text, integer, bigint) from anon;
revoke all on function public.consume_rate_limit(text, integer, bigint) from authenticated;
grant execute on function public.consume_rate_limit(text, integer, bigint) to service_role;
