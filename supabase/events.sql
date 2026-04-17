create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_name text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_user_id_idx
  on public.events (user_id);

create index if not exists events_event_name_idx
  on public.events (event_name);
