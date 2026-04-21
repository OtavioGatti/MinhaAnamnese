create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null,
  amount double precision,
  currency_id text,
  product text,
  external_reference text,
  payer_email text,
  provider_created_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_payments_user_id_idx
  on public.billing_payments (user_id);

create index if not exists billing_payments_status_idx
  on public.billing_payments (status);

create index if not exists billing_payments_processed_at_idx
  on public.billing_payments (processed_at desc);

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
