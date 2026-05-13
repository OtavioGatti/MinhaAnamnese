-- Prescription guide catalog used by the backend for paid professional users.
-- The protocol columns support the Notion CMS model where one row is one copyable protocol.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.prescription_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  condition_name text not null,
  specialty text,
  subcondition text,
  contexts text[] not null default '{}'::text[],
  status text not null default 'published',
  active boolean not null default true,
  source text,
  tipo_protocolo text,
  status_revisao text,
  nivel_risco text,
  resumo_clinico text,
  quando_usar text,
  quando_nao_usar text,
  conduta_procedimento text,
  prescricao_medicamentos text,
  orientacoes_paciente text,
  sinais_alerta text,
  criterios_encaminhamento text,
  observacoes_clinicas text,
  texto_copiavel_conduta text,
  texto_copiavel_prescricao text,
  texto_copiavel_orientacoes text,
  texto_copiavel_completo text,
  fonte text,
  fonte_pagina text,
  fonte_secao text,
  ultima_revisao date,
  revisor text,
  tags text[] not null default '{}'::text[],
  display_order integer not null default 1000,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint prescription_guides_slug_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint prescription_guides_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint prescription_guides_title_not_empty_check
    check (char_length(trim(title)) > 0),
  constraint prescription_guides_condition_not_empty_check
    check (char_length(trim(condition_name)) > 0)
);

alter table public.prescription_guides
  add column if not exists tipo_protocolo text,
  add column if not exists status_revisao text,
  add column if not exists nivel_risco text,
  add column if not exists resumo_clinico text,
  add column if not exists quando_usar text,
  add column if not exists quando_nao_usar text,
  add column if not exists conduta_procedimento text,
  add column if not exists prescricao_medicamentos text,
  add column if not exists orientacoes_paciente text,
  add column if not exists sinais_alerta text,
  add column if not exists criterios_encaminhamento text,
  add column if not exists observacoes_clinicas text,
  add column if not exists texto_copiavel_conduta text,
  add column if not exists texto_copiavel_prescricao text,
  add column if not exists texto_copiavel_orientacoes text,
  add column if not exists texto_copiavel_completo text,
  add column if not exists fonte text,
  add column if not exists fonte_pagina text,
  add column if not exists fonte_secao text,
  add column if not exists ultima_revisao date,
  add column if not exists revisor text,
  add column if not exists tags text[] not null default '{}'::text[];

create table if not exists public.prescription_guide_items (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.prescription_guides(id) on delete cascade,
  source_slug text not null unique,
  order_index integer not null default 1000,
  item_type text not null,
  category text not null default 'Medicamento',
  title text not null,
  medication text,
  presentation text,
  dose text,
  route text,
  frequency text,
  duration text,
  dilution text,
  instructions text not null,
  care_notes text,
  warnings text,
  review_status text not null default 'Revisão pendente',
  confidence text,
  copy_text text not null,
  source_text text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint prescription_guide_items_type_check
    check (item_type in ('Conduta', 'Prescrição')),
  constraint prescription_guide_items_title_not_empty_check
    check (char_length(trim(title)) > 0),
  constraint prescription_guide_items_instructions_not_empty_check
    check (char_length(trim(instructions)) > 0),
  constraint prescription_guide_items_copy_text_not_empty_check
    check (char_length(trim(copy_text)) > 0)
);

create index if not exists prescription_guides_active_search_idx
  on public.prescription_guides (active, status, specialty, condition_name);

create index if not exists prescription_guides_condition_trgm_idx
  on public.prescription_guides using gin (condition_name extensions.gin_trgm_ops);

create index if not exists prescription_guides_title_trgm_idx
  on public.prescription_guides using gin (title extensions.gin_trgm_ops);

create index if not exists prescription_guides_subcondition_trgm_idx
  on public.prescription_guides using gin (subcondition extensions.gin_trgm_ops);

create index if not exists prescription_guides_tags_idx
  on public.prescription_guides using gin (tags);

create index if not exists prescription_guide_items_guide_order_idx
  on public.prescription_guide_items (guide_id, active, order_index);

create index if not exists prescription_guide_items_category_idx
  on public.prescription_guide_items (category);

create or replace function public.set_prescription_guides_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_prescription_guides_updated_at on public.prescription_guides;
create trigger set_prescription_guides_updated_at
before update on public.prescription_guides
for each row
execute function public.set_prescription_guides_updated_at();

drop trigger if exists set_prescription_guide_items_updated_at on public.prescription_guide_items;
create trigger set_prescription_guide_items_updated_at
before update on public.prescription_guide_items
for each row
execute function public.set_prescription_guides_updated_at();

alter table public.prescription_guides enable row level security;
alter table public.prescription_guide_items enable row level security;

drop policy if exists prescription_guides_select_paid_professional on public.prescription_guides;
create policy prescription_guides_select_paid_professional
  on public.prescription_guides
  for select
  to authenticated
  using (
    active = true
    and status = 'published'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.current_plan = 'pro'
        and profiles.billing_status = 'active'
        and (
          profiles.plan_expires_at is null
          or profiles.plan_expires_at > timezone('utc', now())
        )
    )
  );

drop policy if exists prescription_guide_items_select_paid_professional on public.prescription_guide_items;
create policy prescription_guide_items_select_paid_professional
  on public.prescription_guide_items
  for select
  to authenticated
  using (
    active = true
    and review_status <> 'Não usar sem validação'
    and exists (
      select 1
      from public.prescription_guides
      where prescription_guides.id = prescription_guide_items.guide_id
        and prescription_guides.active = true
        and prescription_guides.status = 'published'
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.current_plan = 'pro'
        and profiles.billing_status = 'active'
        and (
          profiles.plan_expires_at is null
          or profiles.plan_expires_at > timezone('utc', now())
        )
    )
  );
