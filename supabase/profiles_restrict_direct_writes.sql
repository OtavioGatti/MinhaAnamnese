-- Remove stale profiles write policies from before the backend owned all
-- profile writes via the service role (which bypasses RLS entirely).
--
-- Both policies scoped only by `auth.uid() = id`, with no column restriction
-- and no WITH CHECK — so any authenticated user could write their own
-- current_plan/billing_status/plan_expires_at directly via the Supabase REST
-- API (PostgREST), skipping the backend's plan-verification logic and the
-- payment webhook entirely:
--
--   PATCH /rest/v1/profiles?id=eq.<own uid>
--   {"current_plan":"pro","billing_status":"active"}
--
--   POST /rest/v1/profiles
--   {"id":"<own uid>","current_plan":"pro","billing_status":"active"}
--   (would only succeed if the backend hadn't already created the row)
--
-- profiles should be written exclusively by the backend/service role, same
-- as billing_payments, events and usage_logs (see security_rls.sql) — no
-- direct anon/authenticated write policy should exist for it.

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
