-- Modelos oficiais de carta/documento (CMS Notion "Minha Anamnese - Modelos de
-- Carta CMS"), sincronizados pelo backend via /api/admin/letter-models/sync.
-- So o format_body (esqueleto que a IA preenche) e usado; as regras clinicas de
-- cada tipo ficam no prompt-base do backend. Aplicar manualmente no SQL Editor
-- do Supabase (idempotente).

create table if not exists public.official_letter_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text,
  name text not null,
  letter_type text,
  format_body text not null,
  internal_notes text,
  status text not null default 'draft',
  display_order integer not null default 1000,
  source_updated_at timestamptz,
  synced_at timestamptz,
  sync_status text,
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.official_letter_models
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists name text,
  add column if not exists letter_type text,
  add column if not exists format_body text,
  add column if not exists internal_notes text,
  add column if not exists status text not null default 'draft',
  add column if not exists display_order integer not null default 1000,
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_status text,
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists official_letter_models_slug_idx
  on public.official_letter_models (slug);

create index if not exists official_letter_models_status_type_idx
  on public.official_letter_models (status, letter_type, display_order);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'official_letter_models_status_check'
  ) then
    alter table public.official_letter_models
      add constraint official_letter_models_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create or replace function public.set_official_letter_models_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_official_letter_models_updated_at on public.official_letter_models;
create trigger set_official_letter_models_updated_at
before update on public.official_letter_models
for each row
execute function public.set_official_letter_models_updated_at();

-- Conteudo editorial publico (leitura); escrita apenas pelo service role.
alter table public.official_letter_models enable row level security;

drop policy if exists official_letter_models_select_published on public.official_letter_models;
create policy official_letter_models_select_published
  on public.official_letter_models
  for select
  to authenticated, anon
  using (status = 'published');
