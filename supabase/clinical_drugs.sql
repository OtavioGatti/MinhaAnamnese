-- Clinical drug catalog synced from Notion.
-- The backend reads this through the service role and exposes a safe search API
-- for the Bulário Clínico page and future autocomplete support.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.clinical_drugs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text unique,
  active_ingredient text not null,
  class_category text,
  contraindications text,
  adult_dosage text,
  pediatric_dosage text,
  warnings text,
  interactions text,
  presentations text,
  commercial_names_anvisa text,
  commercial_names_openai text,
  anvisa_presentations text,
  anvisa_companies text,
  source_bula text,
  pdf_file text,
  extraction_status text,
  review_status text,
  publication_status text not null default 'draft',
  pregnancy_risk text,
  search_tags text,
  summary_text text,
  extraction_date date,
  anvisa_enrichment_status text,
  openai_commercial_names_status text,
  openai_commercial_names_date date,
  openai_commercial_names_sources text,
  search_terms text not null default '',
  source_updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now()),
  sync_status text not null default 'synced',
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clinical_drugs_slug_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint clinical_drugs_active_ingredient_not_empty_check
    check (char_length(trim(active_ingredient)) > 0),
  constraint clinical_drugs_publication_status_check
    check (publication_status in ('draft', 'published', 'archived')),
  constraint clinical_drugs_pregnancy_risk_check
    check (pregnancy_risk is null or pregnancy_risk in ('A', 'B', 'C', 'D', 'X', 'Indefinido', 'Evitar')),
  constraint clinical_drugs_sync_status_check
    check (sync_status in ('synced', 'skipped', 'failed'))
);

alter table public.clinical_drugs
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists active_ingredient text,
  add column if not exists class_category text,
  add column if not exists contraindications text,
  add column if not exists adult_dosage text,
  add column if not exists pediatric_dosage text,
  add column if not exists warnings text,
  add column if not exists interactions text,
  add column if not exists presentations text,
  add column if not exists commercial_names_anvisa text,
  add column if not exists commercial_names_openai text,
  add column if not exists anvisa_presentations text,
  add column if not exists anvisa_companies text,
  add column if not exists source_bula text,
  add column if not exists pdf_file text,
  add column if not exists extraction_status text,
  add column if not exists review_status text,
  add column if not exists publication_status text not null default 'draft',
  add column if not exists pregnancy_risk text,
  add column if not exists search_tags text,
  add column if not exists summary_text text,
  add column if not exists extraction_date date,
  add column if not exists anvisa_enrichment_status text,
  add column if not exists openai_commercial_names_status text,
  add column if not exists openai_commercial_names_date date,
  add column if not exists openai_commercial_names_sources text,
  add column if not exists search_terms text not null default '',
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz not null default timezone('utc', now()),
  add column if not exists sync_status text not null default 'synced',
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.clinical_drugs
set
  publication_status = 'draft'
where publication_status is null
   or publication_status not in ('draft', 'published', 'archived');

update public.clinical_drugs
set
  search_terms = ''
where search_terms is null;

alter table public.clinical_drugs
  drop constraint if exists clinical_drugs_slug_check,
  drop constraint if exists clinical_drugs_active_ingredient_not_empty_check,
  drop constraint if exists clinical_drugs_publication_status_check,
  drop constraint if exists clinical_drugs_pregnancy_risk_check,
  drop constraint if exists clinical_drugs_sync_status_check;

alter table public.clinical_drugs
  add constraint clinical_drugs_slug_check
    check (slug is not null and slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint clinical_drugs_active_ingredient_not_empty_check
    check (active_ingredient is not null and char_length(trim(active_ingredient)) > 0),
  add constraint clinical_drugs_publication_status_check
    check (publication_status in ('draft', 'published', 'archived')),
  add constraint clinical_drugs_pregnancy_risk_check
    check (pregnancy_risk is null or pregnancy_risk in ('A', 'B', 'C', 'D', 'X', 'Indefinido', 'Evitar')),
  add constraint clinical_drugs_sync_status_check
    check (sync_status in ('synced', 'skipped', 'failed'));

create unique index if not exists clinical_drugs_slug_idx
  on public.clinical_drugs (slug);

create unique index if not exists clinical_drugs_notion_page_id_idx
  on public.clinical_drugs (notion_page_id)
  where notion_page_id is not null;

create index if not exists clinical_drugs_publication_search_idx
  on public.clinical_drugs (publication_status, active_ingredient);

create index if not exists clinical_drugs_active_ingredient_trgm_idx
  on public.clinical_drugs using gin (active_ingredient extensions.gin_trgm_ops);

create index if not exists clinical_drugs_class_category_trgm_idx
  on public.clinical_drugs using gin (class_category extensions.gin_trgm_ops);

create index if not exists clinical_drugs_search_terms_trgm_idx
  on public.clinical_drugs using gin (search_terms extensions.gin_trgm_ops);

create or replace function public.set_clinical_drugs_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_clinical_drugs_updated_at on public.clinical_drugs;

create trigger set_clinical_drugs_updated_at
before update on public.clinical_drugs
for each row
execute function public.set_clinical_drugs_updated_at();

alter table public.clinical_drugs enable row level security;

-- No direct anon/authenticated policies are created for clinical_drugs.
-- The backend/service role is responsible for sync and read access.
