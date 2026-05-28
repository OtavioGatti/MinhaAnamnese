update public.profiles
set
  current_plan = 'pro',
  billing_status = 'active',
  access_source = 'trial',
  plan_expires_at = trial_started_at + interval '7 days'
where access_source = 'trial'
  and trial_started_at is not null
  and trial_started_at + interval '7 days' > timezone('utc', now())
  and (
    plan_expires_at is null
    or plan_expires_at < trial_started_at + interval '7 days'
    or billing_status = 'expired'
  );
