-- Materiais (aba "Materiais"): impressos e escalas em PDF, e links para a página
-- oficial de escalas com licença restrita. Cadastrados no Notion (base
-- "Materiais") e sincronizados por /api/admin/materials/sync, que também copia o
-- PDF do Notion para o Storage (o link de anexo do Notion expira em 1 hora).
-- Idempotente.

create table if not exists public.clinical_materials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text unique,
  title text not null,
  category text,
  description text,
  -- proprio = material nosso; escala_livre = escala com licença aberta, PDF
  -- hospedado com o crédito; link_oficial = escala restrita, só o link do autor.
  material_type text not null default 'proprio',
  credit text,
  external_url text,
  storage_path text,
  file_name text,
  file_size integer,
  status text not null default 'draft',
  display_order integer not null default 1000,
  -- Sem acento e em minúsculas: a busca não depende de digitar o acento.
  search_terms text not null default '',
  source_updated_at timestamptz,
  file_synced_at timestamptz,
  synced_at timestamptz,
  sync_status text,
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.clinical_materials
  add column if not exists notion_page_id text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists material_type text not null default 'proprio',
  add column if not exists credit text,
  add column if not exists external_url text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size integer,
  add column if not exists status text not null default 'draft',
  add column if not exists display_order integer not null default 1000,
  add column if not exists search_terms text not null default '',
  add column if not exists source_updated_at timestamptz,
  add column if not exists file_synced_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_status text,
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists clinical_materials_notion_page_id_idx
  on public.clinical_materials (notion_page_id);

create index if not exists clinical_materials_status_order_idx
  on public.clinical_materials (status, display_order);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_materials_status_check'
  ) then
    alter table public.clinical_materials
      add constraint clinical_materials_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clinical_materials_type_check'
  ) then
    alter table public.clinical_materials
      add constraint clinical_materials_type_check
      check (material_type in ('proprio', 'escala_livre', 'link_oficial'));
  end if;
end $$;

create or replace function public.set_clinical_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_clinical_materials_updated_at on public.clinical_materials;
create trigger set_clinical_materials_updated_at
before update on public.clinical_materials
for each row
execute function public.set_clinical_materials_updated_at();

-- Sem policy de propósito: parte do catálogo é do plano profissional e o corte é
-- feito na API. O anon tem SELECT concedido nas tabelas do schema public, então
-- aqui só a RLS sem policy impede a leitura direta; o backend usa service role.
alter table public.clinical_materials enable row level security;

-- Bucket privado: nenhum PDF tem endereço público. Quem entrega o arquivo é a
-- API (/api/materials/download), depois de conferir a conta e o plano.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 15728640, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
