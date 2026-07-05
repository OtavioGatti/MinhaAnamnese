-- Saques de comissão de afiliados: pedido pelo afiliado, transferência manual (PIX)
-- pelo dono e baixa que zera o saldo. Livro-razão auditável pelos dois lados.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).
-- Requer: supabase/affiliate_program.sql já aplicado.

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount numeric(12, 2) not null,
  currency_id text not null default 'BRL',
  status text not null default 'requested',
  pix_key text,
  note text,
  requested_at timestamptz not null default timezone('utc', now()),
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliate_payouts_status_check'
  ) then
    alter table public.affiliate_payouts
      add constraint affiliate_payouts_status_check
      check (status in ('requested', 'paid', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliate_payouts_amount_check'
  ) then
    alter table public.affiliate_payouts
      add constraint affiliate_payouts_amount_check
      check (amount > 0);
  end if;
end $$;

create index if not exists affiliate_payouts_affiliate_id_idx
  on public.affiliate_payouts (affiliate_id, requested_at desc);

-- Garante no máximo um saque aberto por afiliado.
create unique index if not exists affiliate_payouts_single_open_idx
  on public.affiliate_payouts (affiliate_id)
  where status = 'requested';

-- Comissões passam a apontar para o saque que as consolidou.
alter table public.affiliate_commissions
  add column if not exists payout_id uuid references public.affiliate_payouts(id) on delete set null;

create index if not exists affiliate_commissions_payout_id_idx
  on public.affiliate_commissions (payout_id)
  where payout_id is not null;

drop trigger if exists set_affiliate_payouts_updated_at on public.affiliate_payouts;
create trigger set_affiliate_payouts_updated_at
before update on public.affiliate_payouts
for each row
execute function public.set_affiliate_program_updated_at();

alter table public.affiliate_payouts enable row level security;

drop policy if exists affiliate_payouts_select_own on public.affiliate_payouts;
create policy affiliate_payouts_select_own
  on public.affiliate_payouts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.affiliates
      where affiliates.id = affiliate_payouts.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

-- Escrita apenas pelo service role (backend).

-- Pedido de saque atômico: valida saldo, cria o payout e "prende" as comissões
-- disponíveis (pending/approved sem payout) dentro dele.
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
  v_amount numeric(12, 2);
  v_payout public.affiliate_payouts%rowtype;
begin
  if p_affiliate_id is null then
    return jsonb_build_object('ok', false, 'error', 'affiliate_required');
  end if;

  -- Serializa pedidos concorrentes do mesmo afiliado dentro da transação.
  perform pg_advisory_xact_lock(hashtext('affiliate_payout:' || p_affiliate_id::text));

  select count(*) into v_open_count
  from public.affiliate_payouts
  where affiliate_id = p_affiliate_id
    and status = 'requested';

  if v_open_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'payout_already_open');
  end if;

  select coalesce(sum(commission_amount), 0) into v_amount
  from public.affiliate_commissions
  where affiliate_id = p_affiliate_id
    and payout_id is null
    and status in ('pending', 'approved');

  if v_amount < p_min_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'below_minimum',
      'available', v_amount,
      'minimum', p_min_amount
    );
  end if;

  insert into public.affiliate_payouts (affiliate_id, amount, pix_key, status)
  values (p_affiliate_id, v_amount, nullif(trim(coalesce(p_pix_key, '')), ''), 'requested')
  returning * into v_payout;

  update public.affiliate_commissions
  set payout_id = v_payout.id
  where affiliate_id = p_affiliate_id
    and payout_id is null
    and status in ('pending', 'approved');

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
end;
$$;

-- Baixa do saque pelo dono após a transferência manual:
--   'paid'     -> saque pago, comissões viram 'paid' (saldo disponível zera).
--   'rejected' -> saque rejeitado, comissões voltam ao saldo disponível.
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

    return jsonb_build_object('ok', true, 'payout', to_jsonb(v_payout));
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_action');
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

-- Operação (exemplos):
--   Dar baixa após fazer o PIX:
--     select public.settle_affiliate_payout('<payout_id>', 'paid', 'PIX enviado em 04/07');
--
--   Rejeitar um pedido (saldo volta ao afiliado):
--     select public.settle_affiliate_payout('<payout_id>', 'rejected', 'Chave PIX inválida');
--
--   Listar saques pendentes:
--     select p.id, a.code, p.amount, p.pix_key, p.requested_at
--     from public.affiliate_payouts p
--     join public.affiliates a on a.id = p.affiliate_id
--     where p.status = 'requested'
--     order by p.requested_at;
