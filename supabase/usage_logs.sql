create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  template_id text,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_id_idx
  on public.usage_logs (user_id);

create index if not exists usage_logs_template_id_idx
  on public.usage_logs (template_id);
