-- Official prompts synced from Notion.
-- The backend reads these through the service role and keeps local prompt
-- builders as a runtime fallback.

create table if not exists public.official_prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text unique,
  name text not null,
  category text,
  category_key text,
  prompt_type text,
  model text,
  description text,
  when_to_use text,
  variables jsonb not null default '[]'::jsonb,
  prompt_body text not null,
  source text,
  internal_notes text,
  status text not null default 'draft',
  version integer not null default 1,
  display_order integer not null default 1000,
  source_updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced',
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.official_prompts
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists category_key text,
  add column if not exists prompt_type text,
  add column if not exists model text,
  add column if not exists description text,
  add column if not exists when_to_use text,
  add column if not exists variables jsonb not null default '[]'::jsonb,
  add column if not exists prompt_body text,
  add column if not exists source text,
  add column if not exists internal_notes text,
  add column if not exists status text not null default 'draft',
  add column if not exists version integer not null default 1,
  add column if not exists display_order integer not null default 1000,
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz not null default timezone('utc', now()),
  add column if not exists sync_status text not null default 'synced',
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.official_prompts
set
  variables = '[]'::jsonb
where variables is null;

alter table public.official_prompts
  drop constraint if exists official_prompts_slug_format_check,
  drop constraint if exists official_prompts_category_key_format_check,
  drop constraint if exists official_prompts_name_not_empty_check,
  drop constraint if exists official_prompts_prompt_body_not_empty_check,
  drop constraint if exists official_prompts_status_check,
  drop constraint if exists official_prompts_sync_status_check,
  drop constraint if exists official_prompts_variables_array_check;

alter table public.official_prompts
  add constraint official_prompts_slug_format_check
    check (slug is not null and slug = lower(slug) and slug ~ '^[a-z0-9_]+$'),
  add constraint official_prompts_category_key_format_check
    check (category_key is null or (category_key = lower(category_key) and category_key ~ '^[a-z0-9_]+$')),
  add constraint official_prompts_name_not_empty_check
    check (name is not null and char_length(trim(name)) > 0),
  add constraint official_prompts_prompt_body_not_empty_check
    check (prompt_body is not null and char_length(trim(prompt_body)) > 0),
  add constraint official_prompts_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint official_prompts_sync_status_check
    check (sync_status in ('synced', 'skipped', 'failed')),
  add constraint official_prompts_variables_array_check
    check (jsonb_typeof(variables) = 'array');

create unique index if not exists official_prompts_slug_idx
  on public.official_prompts (slug);

create unique index if not exists official_prompts_notion_page_id_idx
  on public.official_prompts (notion_page_id)
  where notion_page_id is not null;

create index if not exists official_prompts_status_order_idx
  on public.official_prompts (status, display_order, name);

create index if not exists official_prompts_type_category_status_idx
  on public.official_prompts (prompt_type, category_key, status, display_order, name);

create unique index if not exists official_prompts_published_type_category_uidx
  on public.official_prompts (prompt_type, category_key)
  where status = 'published'
    and prompt_type is not null
    and category_key is not null;

create or replace function public.set_official_prompts_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_official_prompts_updated_at on public.official_prompts;

create trigger set_official_prompts_updated_at
before update on public.official_prompts
for each row
execute function public.set_official_prompts_updated_at();

alter table public.official_prompts enable row level security;

-- No direct anon/authenticated policies are created for official_prompts.
-- The backend/service role is responsible for sync and read access.
