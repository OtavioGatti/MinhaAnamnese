create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  template_id text,
  resource_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_logs
  add column if not exists resource_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists usage_logs_user_id_idx
  on public.usage_logs (user_id);

create index if not exists usage_logs_template_id_idx
  on public.usage_logs (template_id);

create index if not exists usage_logs_user_action_created_at_idx
  on public.usage_logs (user_id, action, created_at);

create index if not exists usage_logs_user_action_resource_key_idx
  on public.usage_logs (user_id, action, resource_key)
  where resource_key is not null;
