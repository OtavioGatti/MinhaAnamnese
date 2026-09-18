-- Marca da ação de retorno: quem já recebeu o e-mail de reengajamento do teste
-- e em qual grupo caiu (a = nunca usou, b = usou algo mas não viu hipóteses nem
-- prescrição, c = já usou hipóteses ou prescrição).
--
-- Serve para ninguém receber duas vezes e para medir depois, por grupo, quem
-- voltou a usar o site.
--
-- Idempotente. Só adiciona duas colunas vazias: não altera linhas existentes,
-- políticas ou permissões.

alter table public.profiles
  add column if not exists reengagement_sent_at timestamptz,
  add column if not exists reengagement_group text;

comment on column public.profiles.reengagement_sent_at is
  'Quando o e-mail da ação de retorno do teste foi enviado para esta conta.';

comment on column public.profiles.reengagement_group is
  'Grupo da ação de retorno: a (nunca usou), b (usou algo, sem hipóteses/prescrição), c (já usou hipóteses ou prescrição).';
