-- Reengajamento de fim de trial: marca se o e-mail de "termina em breve" e o
-- de "terminou" já foram enviados para cada perfil, para não reenviar todo dia.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

alter table public.profiles
  add column if not exists trial_reminder_2d_sent_at timestamptz,
  add column if not exists trial_reminder_expired_sent_at timestamptz;
