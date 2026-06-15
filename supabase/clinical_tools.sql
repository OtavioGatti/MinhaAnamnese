-- Universal clinical tools catalog synced from Notion.
-- The backend reads this table through the service role and exposes a safe API
-- for dynamic scores, calculators and screening questionnaires.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.clinical_tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text unique,
  title text not null,
  category text,
  subcategory text,
  description text,
  source_reference text,
  tool_type text not null,
  engine_config jsonb not null default '{}'::jsonb,
  fields jsonb not null default '[]'::jsonb,
  result_ranges jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  search_terms text not null default '',
  source_updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced',
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.clinical_tools
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists description text,
  add column if not exists source_reference text,
  add column if not exists tool_type text not null default 'sum_points',
  add column if not exists engine_config jsonb not null default '{}'::jsonb,
  add column if not exists fields jsonb not null default '[]'::jsonb,
  add column if not exists result_ranges jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists search_terms text not null default '',
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz not null default timezone('utc', now()),
  add column if not exists sync_status text not null default 'synced',
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.clinical_tools
set
  tool_type = case
    when lower(tool_type) in ('sum_points', 'soma_pontos') then 'sum_points'
    when lower(tool_type) in ('math_formula', 'formula_matematica') then 'math_formula'
    when lower(tool_type) in ('conditional_logic', 'logica_condicional') then 'conditional_logic'
    else 'sum_points'
  end
where tool_type is null
   or tool_type not in ('sum_points', 'math_formula', 'conditional_logic');

update public.clinical_tools
set status = 'draft'
where status is null
   or status not in ('draft', 'published', 'archived');

update public.clinical_tools
set engine_config = '{}'::jsonb
where engine_config is null;

update public.clinical_tools
set fields = '[]'::jsonb
where fields is null;

update public.clinical_tools
set result_ranges = '[]'::jsonb
where result_ranges is null;

update public.clinical_tools
set search_terms = ''
where search_terms is null;

alter table public.clinical_tools
  drop constraint if exists clinical_tools_slug_check,
  drop constraint if exists clinical_tools_title_not_empty_check,
  drop constraint if exists clinical_tools_tool_type_check,
  drop constraint if exists clinical_tools_status_check,
  drop constraint if exists clinical_tools_engine_config_object_check,
  drop constraint if exists clinical_tools_fields_array_check,
  drop constraint if exists clinical_tools_result_ranges_array_check,
  drop constraint if exists clinical_tools_sync_status_check;

alter table public.clinical_tools
  add constraint clinical_tools_slug_check
    check (slug is not null and slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint clinical_tools_title_not_empty_check
    check (title is not null and char_length(trim(title)) > 0),
  add constraint clinical_tools_tool_type_check
    check (tool_type in ('sum_points', 'math_formula', 'conditional_logic')),
  add constraint clinical_tools_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint clinical_tools_engine_config_object_check
    check (jsonb_typeof(engine_config) = 'object'),
  add constraint clinical_tools_fields_array_check
    check (jsonb_typeof(fields) = 'array'),
  add constraint clinical_tools_result_ranges_array_check
    check (jsonb_typeof(result_ranges) = 'array'),
  add constraint clinical_tools_sync_status_check
    check (sync_status in ('synced', 'skipped', 'failed'));

create unique index if not exists clinical_tools_slug_idx
  on public.clinical_tools (slug);

create unique index if not exists clinical_tools_notion_page_id_idx
  on public.clinical_tools (notion_page_id)
  where notion_page_id is not null;

create index if not exists clinical_tools_status_title_idx
  on public.clinical_tools (status, title);

create index if not exists clinical_tools_category_idx
  on public.clinical_tools (category, subcategory);

create index if not exists clinical_tools_title_trgm_idx
  on public.clinical_tools using gin (title extensions.gin_trgm_ops);

create index if not exists clinical_tools_search_terms_trgm_idx
  on public.clinical_tools using gin (search_terms extensions.gin_trgm_ops);

create or replace function public.set_clinical_tools_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_clinical_tools_updated_at on public.clinical_tools;

create trigger set_clinical_tools_updated_at
before update on public.clinical_tools
for each row
execute function public.set_clinical_tools_updated_at();

alter table public.clinical_tools enable row level security;

-- No direct anon/authenticated policies are created for clinical_tools.
-- The backend/service role is responsible for sync and read access.
