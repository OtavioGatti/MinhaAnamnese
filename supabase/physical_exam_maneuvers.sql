-- Catalogo de manobras e testes de exame fisico (Giordano, gaveta anterior,
-- Murphy...). Conteudo editorial revisado, sincronizado do Notion como os
-- outros catalogos clinicos.
--
-- A IA nomeia a manobra dentro da hipotese diagnostica; a tecnica e a
-- interpretacao do achado vem SEMPRE daqui, nunca do modelo — mesma fronteira
-- do CID (ver backend/prompts/diagnosticHypothesesPrompt.js).

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.physical_exam_maneuvers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  notion_page_id text,
  name text not null,
  -- Sinonimos separados por barra ("Sinal de Giordano / Punho-percussao
  -- lombar"): cada trecho vira uma chave de pareamento em
  -- utils/clinicalAliasMatching.js.
  aliases text,
  -- Regiao ou especialidade: abdominal, ortopedico, neurologico...
  category text,
  -- Condicoes que motivam a manobra, mesmo formato de alias. E por aqui que a
  -- manobra tambem pode ser encontrada a partir do nome da hipotese.
  related_conditions text,
  when_to_perform text,
  how_to_perform text,
  positive_finding text,
  negative_finding text,
  -- Texto descritivo do quanto o teste confirma ou afasta. Numero de
  -- sensibilidade/especificidade so entra com fonte citada em source.
  clinical_utility text,
  source text,
  internal_notes text,
  status text not null default 'draft',
  -- Mesma trava dos itens de prescricao: conteudo nao validado nao chega ao
  -- medico, mesmo publicado por engano.
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
  constraint physical_exam_maneuvers_slug_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint physical_exam_maneuvers_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint physical_exam_maneuvers_name_not_empty_check
    check (char_length(trim(name)) > 0)
);

alter table public.physical_exam_maneuvers
  add column if not exists notion_page_id text,
  add column if not exists aliases text,
  add column if not exists category text,
  add column if not exists related_conditions text,
  add column if not exists when_to_perform text,
  add column if not exists how_to_perform text,
  add column if not exists positive_finding text,
  add column if not exists negative_finding text,
  add column if not exists clinical_utility text,
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

create index if not exists physical_exam_maneuvers_status_idx
  on public.physical_exam_maneuvers (status, active, display_order);

create index if not exists physical_exam_maneuvers_category_idx
  on public.physical_exam_maneuvers (category);

-- Busca por termo na aba Avaliacao: search_text ja vem sem acento do sync.
create index if not exists physical_exam_maneuvers_search_trgm_idx
  on public.physical_exam_maneuvers using gin (search_text extensions.gin_trgm_ops);

-- Backlog editorial: manobra que a IA nomeou e o catalogo ainda nao cobre.
-- Espelha unmatched_diagnostic_hypotheses — e a fila do que vale escrever a
-- seguir, priorizada pela demanda real.
create table if not exists public.unmatched_physical_exam_maneuvers (
  normalized_name text primary key,
  display_name text not null,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  notes text
);

create index if not exists unmatched_physical_exam_maneuvers_pending_idx
  on public.unmatched_physical_exam_maneuvers (resolved_at, occurrences desc);

create or replace function public.set_physical_exam_maneuvers_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_physical_exam_maneuvers_updated_at on public.physical_exam_maneuvers;
create trigger set_physical_exam_maneuvers_updated_at
before update on public.physical_exam_maneuvers
for each row
execute function public.set_physical_exam_maneuvers_updated_at();

alter table public.physical_exam_maneuvers enable row level security;
alter table public.unmatched_physical_exam_maneuvers enable row level security;

-- Mesmo gate dos guias de prescricao: conteudo clinico do plano profissional.
drop policy if exists physical_exam_maneuvers_select_paid_professional on public.physical_exam_maneuvers;
create policy physical_exam_maneuvers_select_paid_professional
  on public.physical_exam_maneuvers
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

-- O backlog e interno: so o service role le e escreve, sem policy para
-- authenticated (mesmo tratamento de unmatched_diagnostic_hypotheses).

-- Registra (ou incrementa) uma manobra sugerida sem correspondencia no
-- catalogo. Espelha record_unmatched_hypothesis.
create or replace function public.record_unmatched_maneuver(
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

  insert into public.unmatched_physical_exam_maneuvers as backlog (
    normalized_name, display_name, occurrences, first_seen_at, last_seen_at
  )
  values (p_normalized_name, coalesce(nullif(trim(p_display_name), ''), p_normalized_name), 1, v_now, v_now)
  on conflict (normalized_name) do update
    set occurrences = backlog.occurrences + 1,
        last_seen_at = v_now,
        display_name = excluded.display_name;
end;
$$;
