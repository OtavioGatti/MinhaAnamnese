-- Desconto por afiliado: percentual aplicado no checkout para compras indicadas.
-- Padrão 0 (sem desconto). Teto de 50% por segurança.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

alter table public.affiliates
  add column if not exists discount_rate numeric(5, 4) not null default 0,
  add column if not exists discount_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliates_discount_rate_check'
  ) then
    alter table public.affiliates
      add constraint affiliates_discount_rate_check
      check (discount_rate >= 0 and discount_rate <= 0.5);
  end if;
end $$;

-- Operação (exemplos):
--   Ativar 10% de desconto para um afiliado:
--     update public.affiliates
--     set discount_rate = 0.10, discount_label = 'Atlética XYZ'
--     where code = 'atletica-xyz';
--
--   Alterar a comissão de um afiliado (padrão global é 30%):
--     update public.affiliates set commission_rate = 0.20 where code = 'atletica-xyz';
--
--   Desativar o desconto:
--     update public.affiliates set discount_rate = 0, discount_label = null where code = 'atletica-xyz';
