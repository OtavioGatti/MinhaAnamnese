create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  current_plan text not null default 'basic',
  last_template_used text,
  default_contextual_tab text not null default 'guide',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists current_plan text not null default 'basic',
  add column if not exists last_template_used text,
  add column if not exists default_contextual_tab text not null default 'guide',
  add column if not exists billing_status text not null default 'inactive',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists free_full_insights_used_count integer not null default 0,
  add column if not exists trial_started_at timestamptz,
  add column if not exists last_payment_id text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.profiles
  alter column current_plan set default 'basic';

alter table public.profiles
  alter column default_contextual_tab set default 'guide';

alter table public.profiles
  alter column billing_status set default 'inactive';

alter table public.profiles
  alter column free_full_insights_used_count set default 0;

update public.profiles
set billing_status = 'inactive'
where billing_status is null;

update public.profiles
set free_full_insights_used_count = 0
where free_full_insights_used_count is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_current_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_current_plan_check
      check (current_plan in ('basic', 'pro'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_contextual_tab_check'
  ) then
    alter table public.profiles
      add constraint profiles_default_contextual_tab_check
      check (default_contextual_tab in ('guide', 'checklist', 'calculator', 'structure'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_billing_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_billing_status_check
      check (billing_status in ('inactive', 'active', 'expired'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_free_full_insights_used_count_check'
  ) then
    alter table public.profiles
      add constraint profiles_free_full_insights_used_count_check
      check (free_full_insights_used_count >= 0);
  end if;
end $$;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();
