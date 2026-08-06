-- Limite de comissões por indicado: o afiliado recebe no máximo N comissões de
-- cada usuário que indicou. Contagem de PAGAMENTOS comissionados, não de tempo:
-- 6 = seis comissões, encerrando após a sexta, independentemente da data.
--
-- Se o indicado cancelar antes (ex.: no 3º mês), o repasse para junto — não há
-- pagamento novo gerando comissão. O limite só corta quem chegaria além de N.
--
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).
-- Requer: supabase/affiliate_program.sql aplicado.

-- 1) Teto por afiliado. NULL = sem limite (comportamento atual, vitalício).
alter table public.affiliates
  add column if not exists commission_max_count integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'affiliates_commission_max_count_check'
  ) then
    alter table public.affiliates
      add constraint affiliates_commission_max_count_check
      check (commission_max_count is null or commission_max_count > 0);
  end if;
end $$;

comment on column public.affiliates.commission_max_count is
  'Máximo de comissões por indicado. NULL = ilimitado. Editável por afiliado.';

-- 2) Marcador de quais pares (afiliado, indicado) entram na contagem.
--
-- Só existe para relações cuja PRIMEIRA comissão foi criada depois desta
-- funcionalidade. Par sem marcador é relação antiga e continua vitalícia, mesmo
-- que o afiliado passe a ter limite depois — evita cortar retroativamente quem
-- foi indicado sob a regra antiga.
--
-- Não guarda contador: a contagem real sai de affiliate_commissions, que já é a
-- fonte de verdade. Duplicar o número aqui criaria divergência silenciosa.
create table if not exists public.affiliate_commission_limits (
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  first_commission_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (affiliate_id, buyer_user_id)
);

comment on table public.affiliate_commission_limits is
  'Pares (afiliado, indicado) sujeitos ao teto de comissões. Ausência do par = relação anterior à regra, sem limite.';

create index if not exists affiliate_commission_limits_affiliate_id_idx
  on public.affiliate_commission_limits (affiliate_id, created_at desc);

-- 3) Contagem por par. Inclui comissão cancelada/estornada de propósito: o
-- pagamento daquele ciclo aconteceu e consumiu uma das N vagas. O estorno é
-- tratado à parte pelo clawback (affiliate_refund_protection.sql).
create index if not exists affiliate_commissions_affiliate_buyer_idx
  on public.affiliate_commissions (affiliate_id, buyer_user_id);

alter table public.affiliate_commission_limits enable row level security;

-- Sem policies: apenas o service role (backend) lê e escreve, igual ao restante
-- do programa de afiliados. O afiliado enxerga o próprio saldo pelas views já
-- existentes de affiliate_commissions.
