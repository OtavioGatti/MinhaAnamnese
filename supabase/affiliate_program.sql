create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null default 'active',
  commission_rate numeric(5, 4) not null default 0.3000,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.affiliates
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists code text,
  add column if not exists status text not null default 'active',
  add column if not exists commission_rate numeric(5, 4) not null default 0.3000,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists affiliates_user_id_idx
  on public.affiliates (user_id);

create unique index if not exists affiliates_code_idx
  on public.affiliates (code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliates_code_format_check'
  ) then
    alter table public.affiliates
      add constraint affiliates_code_format_check
      check (
        char_length(trim(code)) between 3 and 48
        and code = lower(code)
        and code ~ '^[a-z0-9-]+$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliates_status_check'
  ) then
    alter table public.affiliates
      add constraint affiliates_status_check
      check (status in ('active', 'paused'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliates_commission_rate_check'
  ) then
    alter table public.affiliates
      add constraint affiliates_commission_rate_check
      check (commission_rate >= 0 and commission_rate <= 1);
  end if;
end $$;

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  affiliate_code text not null,
  source_url text,
  expires_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.affiliate_attributions
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete cascade,
  add column if not exists buyer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists affiliate_code text,
  add column if not exists source_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists converted_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists affiliate_attributions_buyer_user_id_idx
  on public.affiliate_attributions (buyer_user_id, created_at desc)
  where buyer_user_id is not null;

create index if not exists affiliate_attributions_affiliate_id_idx
  on public.affiliate_attributions (affiliate_id, created_at desc);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  preapproval_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  plan_key text not null default 'monthly',
  amount double precision,
  currency_id text,
  payer_email text,
  external_reference text,
  next_payment_date timestamptz,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  affiliate_code text,
  provider_created_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_subscriptions
  add column if not exists preapproval_id text,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'pending',
  add column if not exists plan_key text not null default 'monthly',
  add column if not exists amount double precision,
  add column if not exists currency_id text,
  add column if not exists payer_email text,
  add column if not exists external_reference text,
  add column if not exists next_payment_date timestamptz,
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists affiliate_code text,
  add column if not exists provider_created_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists billing_subscriptions_preapproval_id_idx
  on public.billing_subscriptions (preapproval_id);

create index if not exists billing_subscriptions_user_id_idx
  on public.billing_subscriptions (user_id);

create index if not exists billing_subscriptions_affiliate_id_idx
  on public.billing_subscriptions (affiliate_id)
  where affiliate_id is not null;

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  payment_id text not null unique,
  plan_key text not null,
  billing_kind text not null,
  gross_amount numeric(12, 2) not null,
  commission_rate numeric(5, 4) not null,
  commission_amount numeric(12, 2) not null,
  currency_id text not null default 'BRL',
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.affiliate_commissions
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete cascade,
  add column if not exists buyer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists payment_id text,
  add column if not exists plan_key text,
  add column if not exists billing_kind text,
  add column if not exists gross_amount numeric(12, 2),
  add column if not exists commission_rate numeric(5, 4),
  add column if not exists commission_amount numeric(12, 2),
  add column if not exists currency_id text not null default 'BRL',
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists affiliate_commissions_payment_id_idx
  on public.affiliate_commissions (payment_id);

create index if not exists affiliate_commissions_affiliate_id_idx
  on public.affiliate_commissions (affiliate_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliate_commissions_status_check'
  ) then
    alter table public.affiliate_commissions
      add constraint affiliate_commissions_status_check
      check (status in ('pending', 'approved', 'paid', 'cancelled'));
  end if;
end $$;

create or replace function public.set_affiliate_program_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_affiliates_updated_at on public.affiliates;
create trigger set_affiliates_updated_at
before update on public.affiliates
for each row
execute function public.set_affiliate_program_updated_at();

drop trigger if exists set_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger set_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row
execute function public.set_affiliate_program_updated_at();

drop trigger if exists set_affiliate_commissions_updated_at on public.affiliate_commissions;
create trigger set_affiliate_commissions_updated_at
before update on public.affiliate_commissions
for each row
execute function public.set_affiliate_program_updated_at();

alter table public.affiliates enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliates_select_own on public.affiliates;
create policy affiliates_select_own
  on public.affiliates
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists affiliate_commissions_select_own on public.affiliate_commissions;
create policy affiliate_commissions_select_own
  on public.affiliate_commissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.affiliates
      where affiliates.id = affiliate_commissions.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

-- Inserts and updates are performed only by the backend service role.
