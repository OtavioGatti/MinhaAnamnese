create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null,
  amount double precision,
  currency_id text,
  product text,
  plan_key text,
  billing_kind text,
  preapproval_id text,
  affiliate_id uuid,
  affiliate_code text,
  commission_amount numeric(12, 2),
  external_reference text,
  payer_email text,
  provider_created_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_payments
  add column if not exists plan_key text,
  add column if not exists billing_kind text,
  add column if not exists preapproval_id text,
  add column if not exists affiliate_id uuid,
  add column if not exists affiliate_code text,
  add column if not exists commission_amount numeric(12, 2);

create index if not exists billing_payments_user_id_idx
  on public.billing_payments (user_id);

create index if not exists billing_payments_status_idx
  on public.billing_payments (status);

create index if not exists billing_payments_processed_at_idx
  on public.billing_payments (processed_at desc);

create index if not exists billing_payments_preapproval_id_idx
  on public.billing_payments (preapproval_id)
  where preapproval_id is not null;

create index if not exists billing_payments_affiliate_id_idx
  on public.billing_payments (affiliate_id)
  where affiliate_id is not null;

create or replace function public.set_billing_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_payments_set_updated_at
  on public.billing_payments;

create trigger billing_payments_set_updated_at
before update on public.billing_payments
for each row
execute function public.set_billing_payments_updated_at();
