create table if not exists public.user_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_templates
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.user_templates
set sections = '[]'::jsonb
where sections is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_templates_name_not_empty_check'
  ) then
    alter table public.user_templates
      add constraint user_templates_name_not_empty_check
      check (char_length(trim(name)) > 0 and char_length(name) <= 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_templates_sections_array_check'
  ) then
    alter table public.user_templates
      add constraint user_templates_sections_array_check
      check (
        jsonb_typeof(sections) = 'array'
        and jsonb_array_length(sections) between 2 and 24
      );
  end if;
end $$;

create index if not exists user_templates_user_id_updated_at_idx
  on public.user_templates (user_id, updated_at desc);

create or replace function public.set_user_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_templates_updated_at on public.user_templates;

create trigger set_user_templates_updated_at
before update on public.user_templates
for each row
execute function public.set_user_templates_updated_at();

alter table public.user_templates enable row level security;

drop policy if exists user_templates_select_own on public.user_templates;
create policy user_templates_select_own
  on public.user_templates
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_templates_insert_own on public.user_templates;
create policy user_templates_insert_own
  on public.user_templates
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_templates_update_own on public.user_templates;
create policy user_templates_update_own
  on public.user_templates
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_templates_delete_own on public.user_templates;
create policy user_templates_delete_own
  on public.user_templates
  for delete
  to authenticated
  using (user_id = auth.uid());
