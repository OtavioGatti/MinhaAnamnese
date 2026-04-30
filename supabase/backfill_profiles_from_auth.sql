-- Backfill non-destructive for users that exist in Supabase Auth but do not
-- have a row in public.profiles yet.
--
-- Run this once in the Supabase SQL editor after deploying the /api/profile
-- route fix. Existing profile rows are preserved.

insert into public.profiles (
  id,
  email,
  current_plan,
  billing_status,
  free_full_insights_used_count,
  default_contextual_tab,
  created_at,
  updated_at
)
select
  users.id,
  users.email,
  case
    when users.raw_user_meta_data->>'plan' = 'pro' then 'pro'
    else 'basic'
  end as current_plan,
  case
    when users.raw_user_meta_data->>'plan' = 'pro' then 'active'
    else 'inactive'
  end as billing_status,
  0 as free_full_insights_used_count,
  'guide' as default_contextual_tab,
  timezone('utc', now()) as created_at,
  timezone('utc', now()) as updated_at
from auth.users
where not exists (
  select 1
  from public.profiles
  where public.profiles.id = users.id
);
