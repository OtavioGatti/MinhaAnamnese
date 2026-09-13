-- Motivo do resultado do pagamento e marca de e-mail enviado.
--
-- status_detail: código técnico do Mercado Pago para o resultado do pagamento
--   (ex.: cc_rejected_insufficient_amount). O painel do Mercado Pago só mostra
--   "o banco emissor recusou"; com o código dá para saber se foi limite,
--   antifraude ou dado digitado errado. A tradução fica no backend, em
--   backend/utils/paymentDeclineReasons.js.
--
-- notified_at: quando o e-mail de pagamento (aprovado ou recusado) daquela
--   linha foi enviado, para o Mercado Pago reenviar a notificação sem gerar
--   e-mail repetido. Ainda sem uso: entra com os e-mails de pagamento.
--
-- Idempotente. Só adiciona duas colunas vazias: não altera linhas existentes,
-- políticas ou permissões.

alter table public.billing_payments
  add column if not exists status_detail text,
  add column if not exists notified_at timestamptz;

comment on column public.billing_payments.status_detail is
  'status_detail do Mercado Pago (motivo do resultado). Tradução em backend/utils/paymentDeclineReasons.js.';

comment on column public.billing_payments.notified_at is
  'Quando o e-mail de pagamento desta linha foi enviado (evita e-mail repetido).';
