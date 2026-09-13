-- Marcas dos avisos de plano por e-mail: semestral vencendo, semestral
-- terminou e acesso mensal pausado por falta de pagamento. Enviados pela rotina
-- diária (backend/services/planNotices.js), a mesma dos lembretes de teste.
--
-- Cada coluna guarda o plan_expires_at a que o aviso se refere. Quando o plano
-- renova, a data muda e o aviso do ciclo novo volta a ser enviado, sem precisar
-- limpar nada.
--
-- Idempotente. Só adiciona três colunas vazias: não altera linhas existentes,
-- políticas ou permissões.

alter table public.profiles
  add column if not exists plan_ending_notice_for timestamptz,
  add column if not exists plan_expired_notice_for timestamptz,
  add column if not exists payment_paused_notice_for timestamptz;

comment on column public.profiles.plan_ending_notice_for is
  'plan_expires_at do semestral para o qual o aviso "vence em 7 dias" já foi enviado.';

comment on column public.profiles.plan_expired_notice_for is
  'plan_expires_at do semestral para o qual o aviso "terminou" já foi enviado.';

comment on column public.profiles.payment_paused_notice_for is
  'plan_expires_at do mensal para o qual o aviso "acesso pausado" já foi enviado.';
