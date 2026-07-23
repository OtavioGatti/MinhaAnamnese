-- Frases prontas do usuário (modelos pessoais de exame físico, conduta etc.).
-- Leitura para todos os logados; criação/edição/exclusão via backend (a regra
-- de "criar é Pro" fica no handler, não no banco). Mesmo padrão de RLS de
-- user_templates. Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.user_snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  snippet_type text,
  display_order integer not null default 1000,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_snippets
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists snippet_type text,
  add column if not exists display_order integer not null default 1000,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists user_snippets_user_id_idx
  on public.user_snippets (user_id, display_order, created_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_snippets_title_length_check'
  ) then
    alter table public.user_snippets
      add constraint user_snippets_title_length_check
      check (char_length(title) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_snippets_body_length_check'
  ) then
    alter table public.user_snippets
      add constraint user_snippets_body_length_check
      check (char_length(body) between 1 and 4000);
  end if;
end $$;

create or replace function public.set_user_snippets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_snippets_updated_at on public.user_snippets;
create trigger set_user_snippets_updated_at
before update on public.user_snippets
for each row
execute function public.set_user_snippets_updated_at();

alter table public.user_snippets enable row level security;

drop policy if exists user_snippets_select_own on public.user_snippets;
create policy user_snippets_select_own
  on public.user_snippets
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_snippets_insert_own on public.user_snippets;
create policy user_snippets_insert_own
  on public.user_snippets
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_snippets_update_own on public.user_snippets;
create policy user_snippets_update_own
  on public.user_snippets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_snippets_delete_own on public.user_snippets;
create policy user_snippets_delete_own
  on public.user_snippets
  for delete
  to authenticated
  using (user_id = auth.uid());
