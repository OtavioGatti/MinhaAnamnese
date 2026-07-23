-- Frases prontas oficiais (CMS Notion "Minha Anamnese - Frases Prontas CMS"),
-- sincronizadas pelo backend via /api/admin/snippets/sync. Mesmo padrão de
-- official_templates: upsert por slug, apenas status published aparece no site.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.official_snippets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text,
  name text not null,
  category text,
  category_key text,
  snippet_type text,
  body text not null,
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

alter table public.official_snippets
  add column if not exists slug text,
  add column if not exists notion_page_id text,
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists category_key text,
  add column if not exists snippet_type text,
  add column if not exists body text,
  add column if not exists internal_notes text,
  add column if not exists status text not null default 'draft',
  add column if not exists display_order integer not null default 1000,
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_status text,
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists official_snippets_slug_idx
  on public.official_snippets (slug);

create index if not exists official_snippets_status_order_idx
  on public.official_snippets (status, display_order);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'official_snippets_status_check'
  ) then
    alter table public.official_snippets
      add constraint official_snippets_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create or replace function public.set_official_snippets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_official_snippets_updated_at on public.official_snippets;
create trigger set_official_snippets_updated_at
before update on public.official_snippets
for each row
execute function public.set_official_snippets_updated_at();

-- Conteúdo editorial público (leitura); escrita apenas pelo service role.
alter table public.official_snippets enable row level security;

drop policy if exists official_snippets_select_published on public.official_snippets;
create policy official_snippets_select_published
  on public.official_snippets
  for select
  to authenticated, anon
  using (status = 'published');
