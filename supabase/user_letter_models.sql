-- Modelos de carta/documento do usuario (formato + cabecalho/assinatura por
-- tipo). Leitura para o dono; criacao/edicao/exclusao via backend (a regra de
-- "criar e Pro" fica no handler, nao no banco). is_default marca o modelo padrao
-- por tipo. Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.user_letter_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  letter_type text not null,
  format_body text not null,
  is_default boolean not null default false,
  display_order integer not null default 1000,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_letter_models
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists letter_type text,
  add column if not exists format_body text,
  add column if not exists is_default boolean not null default false,
  add column if not exists display_order integer not null default 1000,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists user_letter_models_user_type_idx
  on public.user_letter_models (user_id, letter_type, display_order, created_at);

-- No maximo um modelo padrao por (usuario, tipo).
create unique index if not exists user_letter_models_default_idx
  on public.user_letter_models (user_id, letter_type)
  where is_default;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_letter_models_title_length_check'
  ) then
    alter table public.user_letter_models
      add constraint user_letter_models_title_length_check
      check (char_length(title) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_letter_models_body_length_check'
  ) then
    alter table public.user_letter_models
      add constraint user_letter_models_body_length_check
      check (char_length(format_body) between 1 and 4000);
  end if;
end $$;

create or replace function public.set_user_letter_models_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_letter_models_updated_at on public.user_letter_models;
create trigger set_user_letter_models_updated_at
before update on public.user_letter_models
for each row
execute function public.set_user_letter_models_updated_at();

alter table public.user_letter_models enable row level security;

drop policy if exists user_letter_models_select_own on public.user_letter_models;
create policy user_letter_models_select_own
  on public.user_letter_models
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_letter_models_insert_own on public.user_letter_models;
create policy user_letter_models_insert_own
  on public.user_letter_models
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_letter_models_update_own on public.user_letter_models;
create policy user_letter_models_update_own
  on public.user_letter_models
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_letter_models_delete_own on public.user_letter_models;
create policy user_letter_models_delete_own
  on public.user_letter_models
  for delete
  to authenticated
  using (user_id = auth.uid());
