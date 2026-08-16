-- Catalogo de exames complementares (hemograma, EAS, PCR, funcao renal, RX de
-- torax...). Conteudo editorial revisado, sincronizado do Notion.
--
-- Mesma fronteira do CID e das manobras: a IA nomeia o exame dentro da hipotese
-- diagnostica; COMO interpretar vem sempre daqui, nunca do modelo.
--
-- Uma linha = um exame completo, com campos de texto longo. Nao ha tabela de
-- parametros separada: o CMS do Notion trabalha uma linha por item (a antiga
-- prescription_guide_items so e escrita pelo importador Python, nao pelo sync).

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.diagnostic_exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text,
  name text not null,
  -- Sinonimos separados por barra ("Hemograma completo / HMG"): cada trecho
  -- vira chave de pareamento em utils/clinicalAliasMatching.js.
  aliases text,
  -- Laboratorial, Imagem, Funcional ou Outro.
  category text,
  -- Condicoes que motivam o pedido, mesmo formato de alias.
  related_conditions text,
  when_to_request text,
  -- Preparo do paciente: jejum, horario da coleta, suspensao de medicacao.
  preparation text,
  -- O bloco principal. Em exame laboratorial, um parametro por linha com a
  -- faixa e o que alteracao alta/baixa sugere. Em imagem, um achado por linha.
  how_to_interpret text,
  -- O que o exame NAO responde, e o que costuma confundir na leitura.
  limitations text,
  source text,
  internal_notes text,
  status text not null default 'draft',
  -- Mesma trava dos outros catalogos: conteudo nao validado nao chega ao medico.
  review_status text not null default 'Revisão pendente',
  active boolean not null default true,
  display_order integer not null default 1000,
  search_text text,
  source_updated_at timestamptz,
  synced_at timestamptz,
  sync_status text,
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint diagnostic_exams_slug_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint diagnostic_exams_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint diagnostic_exams_name_not_empty_check
    check (char_length(trim(name)) > 0)
);

alter table public.diagnostic_exams
  add column if not exists notion_page_id text,
  add column if not exists aliases text,
  add column if not exists category text,
  add column if not exists related_conditions text,
  add column if not exists when_to_request text,
  add column if not exists preparation text,
  add column if not exists how_to_interpret text,
  add column if not exists limitations text,
  add column if not exists source text,
  add column if not exists internal_notes text,
  add column if not exists status text not null default 'draft',
  add column if not exists review_status text not null default 'Revisão pendente',
  add column if not exists active boolean not null default true,
  add column if not exists display_order integer not null default 1000,
  add column if not exists search_text text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_status text,
  add column if not exists sync_error text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists diagnostic_exams_status_idx
  on public.diagnostic_exams (status, active, display_order);

create index if not exists diagnostic_exams_category_idx
  on public.diagnostic_exams (category);

create index if not exists diagnostic_exams_search_trgm_idx
  on public.diagnostic_exams using gin (search_text extensions.gin_trgm_ops);

-- Backlog editorial: exame que a IA nomeou e o catalogo ainda nao cobre.
create table if not exists public.unmatched_diagnostic_exams (
  normalized_name text primary key,
  display_name text not null,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  notes text
);

create index if not exists unmatched_diagnostic_exams_pending_idx
  on public.unmatched_diagnostic_exams (resolved_at, occurrences desc);

create or replace function public.set_diagnostic_exams_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_diagnostic_exams_updated_at on public.diagnostic_exams;
create trigger set_diagnostic_exams_updated_at
before update on public.diagnostic_exams
for each row
execute function public.set_diagnostic_exams_updated_at();

alter table public.diagnostic_exams enable row level security;
alter table public.unmatched_diagnostic_exams enable row level security;

drop policy if exists diagnostic_exams_select_paid_professional on public.diagnostic_exams;
create policy diagnostic_exams_select_paid_professional
  on public.diagnostic_exams
  for select
  to authenticated
  using (
    active = true
    and status = 'published'
    and review_status <> 'Não usar sem validação'
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

-- Registra (ou incrementa) um exame sugerido sem correspondencia no catalogo.
-- Espelha record_unmatched_maneuver.
create or replace function public.record_unmatched_exam(
  p_normalized_name text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if coalesce(trim(p_normalized_name), '') = '' then
    return;
  end if;

  insert into public.unmatched_diagnostic_exams as backlog (
    normalized_name, display_name, occurrences, first_seen_at, last_seen_at
  )
  values (p_normalized_name, coalesce(nullif(trim(p_display_name), ''), p_normalized_name), 1, v_now, v_now)
  on conflict (normalized_name) do update
    set occurrences = backlog.occurrences + 1,
        last_seen_at = v_now,
        display_name = excluded.display_name;
end;
$$;
