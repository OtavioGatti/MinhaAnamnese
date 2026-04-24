-- Incremental RLS hardening for public application tables.
-- The backend uses the Supabase service role for writes, which bypasses RLS.

alter table public.profiles enable row level security;
alter table public.anamneses enable row level security;
alter table public.billing_payments enable row level security;
alter table public.events enable row level security;
alter table public.usage_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists anamneses_select_own on public.anamneses;
create policy anamneses_select_own
  on public.anamneses
  for select
  to authenticated
  using (user_id = auth.uid());

-- No direct anon/authenticated policies are created for billing_payments,
-- events or usage_logs. They should remain accessible only through the
-- backend/service role unless a specific direct-client use case is added.
