-- Proteção contra reembolso/arrependimento (direito de 7 dias do CDC art. 49):
--   1) Carência: comissão só vira saldo sacável 7 dias após a venda, cobrindo a
--      janela em que o cliente ainda pode pedir reembolso.
--   2) Clawback: se um pagamento já comissionado (e pago ao afiliado) for
--      reembolsado, o valor vira dívida descontada de saques futuros.
--   3) Cancelamento seguro por reembolso: trata os 3 casos (comissão solta,
--      presa em saque aberto, ou já paga) atomicamente.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).
-- Requer: supabase/affiliate_program.sql e supabase/affiliate_payouts.sql aplicados.

-- 1) Dívidas de clawback: comissão já paga cujo pagamento foi reembolsado.
create table if not exists public.affiliate_commission_clawbacks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  commission_id uuid references public.affiliate_commissions(id) on delete set null,
  payment_id text not null,
  amount numeric(12, 2) not null,
  currency_id text not null default 'BRL',
  status text not null default 'pending',
  settled_payout_id uuid references public.affiliate_payouts(id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_commission_clawbacks_status_check'
  ) then
    alter table public.affiliate_commission_clawbacks
      add constraint affiliate_commission_clawbacks_status_check
      check (status in ('pending', 'settled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_commission_clawbacks_amount_check'
  ) then
    alter table public.affiliate_commission_clawbacks
      add constraint affiliate_commission_clawbacks_amount_check
      check (amount > 0);
  end if;
end $$;

-- Idempotência: no máximo uma dívida por pagamento reembolsado.
create unique index if not exists affiliate_commission_clawbacks_payment_id_idx
  on public.affiliate_commission_clawbacks (payment_id);

create index if not exists affiliate_commission_clawbacks_affiliate_pending_idx
  on public.affiliate_commission_clawbacks (affiliate_id)
  where status = 'pending';

create index if not exists affiliate_commission_clawbacks_settled_payout_idx
  on public.affiliate_commission_clawbacks (settled_payout_id)
  where settled_payout_id is not null;

drop trigger if exists set_affiliate_commission_clawbacks_updated_at
  on public.affiliate_commission_clawbacks;
create trigger set_affiliate_commission_clawbacks_updated_at
before update on public.affiliate_commission_clawbacks
for each row
execute function public.set_affiliate_program_updated_at();

alter table public.affiliate_commission_clawbacks enable row level security;

drop policy if exists affiliate_commission_clawbacks_select_own
  on public.affiliate_commission_clawbacks;
create policy affiliate_commission_clawbacks_select_own
  on public.affiliate_commission_clawbacks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.affiliates
      where affiliates.id = affiliate_commission_clawbacks.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

-- 2) Pedido de saque com carência de 7 dias + desconto de dívidas de clawback.
--    Supersede a versão de affiliate_payouts.sql (mesma assinatura).
create or replace function public.request_affiliate_payout(
  p_affiliate_id uuid,
  p_pix_key text,
  p_min_amount numeric default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_count integer;
  v_available numeric(12, 2);
  v_debt numeric(12, 2);
  v_net numeric(12, 2);
  v_payout public.affiliate_payouts%rowtype;
begin
  if p_affiliate_id is null then
    return jsonb_build_object('ok', false, 'error', 'affiliate_required');
  end if;

  perform pg_advisory_xact_lock(hashtext('affiliate_payout:' || p_affiliate_id::text));

  select count(*) into v_open_count
  from public.affiliate_payouts
  where affiliate_id = p_affiliate_id
    and status = 'requested';

  if v_open_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'payout_already_open');
  end if;

  -- "Disponível" = pending/approved, fora de saque aberto, e já fora da carência
  -- de 7 dias (created_at ao menos 7 dias atrás) — cobre a janela de reembolso.
  select coalesce(sum(c.commission_amount), 0) into v_available
  from public.affiliate_commissions c
  where c.affiliate_id = p_affiliate_id
    and c.status in ('pending', 'approved')
    and c.created_at <= timezone('utc', now()) - interval '7 days'
    and not exists (
      select 1
      from public.affiliate_payouts p
      where p.id = c.payout_id
        and p.status = 'requested'
    );

  -- Dívidas pendentes de reembolsos anteriores reduzem o valor sacável.
  select coalesce(sum(amount), 0) into v_debt
  from public.affiliate_commission_clawbacks
  where affiliate_id = p_affiliate_id
    and status = 'pending';

  v_net := round(v_available - v_debt, 2);

  if v_net < p_min_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'below_minimum',
      'available', v_net,
      'minimum', p_min_amount
    );
  end if;

  insert into public.affiliate_payouts (affiliate_id, amount, pix_key, status)
  values (p_affiliate_id, v_net, nullif(trim(coalesce(p_pix_key, '')), ''), 'requested')
  returning * into v_payout;

  update public.affiliate_commissions c
  set payout_id = v_payout.id
  where c.affiliate_id = p_affiliate_id
    and c.status in ('pending', 'approved')
    and c.created_at <= timezone('utc', now()) - interval '7 days'
    and not exists (
      select 1
      from public.affiliate_payouts p
      where p.id = c.payout_id
        and p.status = 'requested'
        and p.id <> v_payout.id
    );

  -- O net já descontou a dívida: marca as dívidas pendentes como quitadas por
  -- este saque (revertidas se o saque for rejeitado — ver settle abaixo).
  update public.affiliate_commission_clawbacks
  set status = 'settled',
      settled_payout_id = v_payout.id,
      settled_at = timezone('utc', now())
  where affiliate_id = p_affiliate_id
    and status = 'pending';

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
end;
$$;

-- 3) Baixa do saque: além do comportamento anterior, ao REJEITAR um saque que
--    quitou dívidas de clawback, as dívidas voltam a 'pending'.
create or replace function public.settle_affiliate_payout(
  p_payout_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.affiliate_payouts%rowtype;
begin
  select * into v_payout
  from public.affiliate_payouts
  where id = p_payout_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'payout_not_found');
  end if;

  if v_payout.status <> 'requested' then
    return jsonb_build_object('ok', false, 'error', 'payout_not_open', 'status', v_payout.status);
  end if;

  if p_action = 'paid' then
    update public.affiliate_payouts
    set status = 'paid',
        paid_at = timezone('utc', now()),
        note = coalesce(p_note, note)
    where id = p_payout_id
    returning * into v_payout;

    update public.affiliate_commissions
    set status = 'paid'
    where payout_id = p_payout_id
      and status in ('pending', 'approved');

    return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
  end if;

  if p_action = 'rejected' then
    update public.affiliate_payouts
    set status = 'rejected',
        note = coalesce(p_note, note)
    where id = p_payout_id
    returning * into v_payout;

    update public.affiliate_commissions
    set payout_id = null
    where payout_id = p_payout_id;

    -- Dívidas quitadas por este saque voltam a valer (o saque não foi pago).
    update public.affiliate_commission_clawbacks
    set status = 'pending',
        settled_payout_id = null,
        settled_at = null
    where settled_payout_id = p_payout_id;

    return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_action');
end;
$$;

-- 4) Cancelamento de comissão por reembolso/estorno, tratando os 3 casos:
--    - solta (ou em saque rejeitado): apenas cancela.
--    - presa em saque aberto (requested): abate do valor do saque e solta;
--      se zerar, rejeita o saque e devolve as demais comissões.
--    - já paga: cria dívida de clawback (idempotente por payment_id).
create or replace function public.cancel_affiliate_commission_for_refund(
  p_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.affiliate_commissions%rowtype;
  v_payout public.affiliate_payouts%rowtype;
  v_new_amount numeric(12, 2);
begin
  if p_payment_id is null or length(trim(p_payment_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'payment_required');
  end if;

  select * into v_commission
  from public.affiliate_commissions
  where payment_id = p_payment_id;

  if not found then
    return jsonb_build_object('ok', true, 'result', 'no_commission');
  end if;

  perform pg_advisory_xact_lock(hashtext('affiliate_payout:' || v_commission.affiliate_id::text));

  select * into v_commission
  from public.affiliate_commissions
  where payment_id = p_payment_id
  for update;

  if v_commission.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'result', 'already_cancelled');
  end if;

  -- Já paga: o dinheiro saiu. Registra dívida a ser descontada de saques futuros.
  if v_commission.status = 'paid' then
    insert into public.affiliate_commission_clawbacks (
      affiliate_id, commission_id, payment_id, amount, currency_id, status
    )
    values (
      v_commission.affiliate_id, v_commission.id, p_payment_id,
      v_commission.commission_amount, v_commission.currency_id, 'pending'
    )
    on conflict (payment_id) do nothing;

    update public.affiliate_commissions
    set status = 'cancelled'
    where id = v_commission.id;

    return jsonb_build_object(
      'ok', true, 'result', 'clawback_created', 'amount', v_commission.commission_amount
    );
  end if;

  -- pending/approved: se estiver presa num saque aberto, ajusta o saque.
  if v_commission.payout_id is not null then
    select * into v_payout
    from public.affiliate_payouts
    where id = v_commission.payout_id
    for update;

    if found and v_payout.status = 'requested' then
      v_new_amount := round(v_payout.amount - v_commission.commission_amount, 2);

      if v_new_amount <= 0 then
        update public.affiliate_payouts
        set status = 'rejected',
            note = trim(both ' ' from coalesce(note, '') || ' [estorno automatico]')
        where id = v_payout.id;

        update public.affiliate_commissions
        set payout_id = null
        where payout_id = v_payout.id
          and id <> v_commission.id;

        update public.affiliate_commission_clawbacks
        set status = 'pending',
            settled_payout_id = null,
            settled_at = null
        where settled_payout_id = v_payout.id;
      else
        update public.affiliate_payouts
        set amount = v_new_amount
        where id = v_payout.id;
      end if;
    end if;
  end if;

  update public.affiliate_commissions
  set status = 'cancelled',
      payout_id = null
  where id = v_commission.id;

  return jsonb_build_object(
    'ok', true, 'result', 'cancelled', 'amount', v_commission.commission_amount
  );
end;
$$;

revoke all on function public.request_affiliate_payout(uuid, text, numeric) from public;
revoke all on function public.request_affiliate_payout(uuid, text, numeric) from anon;
revoke all on function public.request_affiliate_payout(uuid, text, numeric) from authenticated;
grant execute on function public.request_affiliate_payout(uuid, text, numeric) to service_role;

revoke all on function public.settle_affiliate_payout(uuid, text, text) from public;
revoke all on function public.settle_affiliate_payout(uuid, text, text) from anon;
revoke all on function public.settle_affiliate_payout(uuid, text, text) from authenticated;
grant execute on function public.settle_affiliate_payout(uuid, text, text) to service_role;

revoke all on function public.cancel_affiliate_commission_for_refund(text) from public;
revoke all on function public.cancel_affiliate_commission_for_refund(text) from anon;
revoke all on function public.cancel_affiliate_commission_for_refund(text) from authenticated;
grant execute on function public.cancel_affiliate_commission_for_refund(text) to service_role;

-- Operação (exemplos):
--   Ver dívidas pendentes de um afiliado:
--     select c.payment_id, c.amount, c.status
--     from public.affiliate_commission_clawbacks c
--     join public.affiliates a on a.id = c.affiliate_id
--     where a.code = '<code>' order by c.created_at desc;
