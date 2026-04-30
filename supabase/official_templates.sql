-- Official templates synced from Notion.
-- The app reads these through the backend/service role and keeps the
-- hardcoded templates as a runtime fallback.

create table if not exists public.official_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text unique,
  name text not null,
  category text,
  description text,
  when_to_use text,
  base_example text,
  sections jsonb not null default '[]'::jsonb,
  guide jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  metadata jsonb not null default '{}'::jsonb,
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

alter table public.official_templates
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists when_to_use text,
  add column if not exists base_example text,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists guide jsonb not null default '[]'::jsonb,
  add column if not exists evaluation jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists version integer not null default 1,
  add column if not exists display_order integer not null default 1000,
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz not null default timezone('utc', now()),
  add column if not exists sync_status text not null default 'synced',
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.official_templates
set
  sections = '[]'::jsonb
where sections is null;

update public.official_templates
set
  guide = '[]'::jsonb
where guide is null;

update public.official_templates
set
  metadata = '{}'::jsonb
where metadata is null;

alter table public.official_templates
  drop constraint if exists official_templates_slug_format_check,
  drop constraint if exists official_templates_name_not_empty_check,
  drop constraint if exists official_templates_status_check,
  drop constraint if exists official_templates_sync_status_check,
  drop constraint if exists official_templates_sections_array_check,
  drop constraint if exists official_templates_guide_array_check;

alter table public.official_templates
  add constraint official_templates_slug_format_check
    check (slug is not null and slug = lower(slug) and slug ~ '^[a-z0-9_]+$'),
  add constraint official_templates_name_not_empty_check
    check (name is not null and char_length(trim(name)) > 0),
  add constraint official_templates_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint official_templates_sync_status_check
    check (sync_status in ('synced', 'skipped', 'failed')),
  add constraint official_templates_sections_array_check
    check (
      jsonb_typeof(sections) = 'array'
      and jsonb_array_length(sections) between 0 and 40
    ),
  add constraint official_templates_guide_array_check
    check (jsonb_typeof(guide) = 'array');

create unique index if not exists official_templates_slug_idx
  on public.official_templates (slug);

create unique index if not exists official_templates_notion_page_id_idx
  on public.official_templates (notion_page_id)
  where notion_page_id is not null;

create index if not exists official_templates_status_order_idx
  on public.official_templates (status, display_order, name);

create or replace function public.set_official_templates_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_official_templates_updated_at on public.official_templates;

create trigger set_official_templates_updated_at
before update on public.official_templates
for each row
execute function public.set_official_templates_updated_at();

alter table public.official_templates enable row level security;

-- No direct anon/authenticated policies are created for official_templates.
-- The backend/service role is responsible for sync and read access.
