-- Indicação de afiliado salva na conta.
--
-- ATÉ AQUI a indicação só existia no navegador (localStorage) e só virava
-- registro no checkout. Isso perdia comissão legítima em três casos:
--   1. a pessoa chega pelo link no celular e assina no computador;
--   2. a pessoa limpa os dados do navegador antes de assinar;
--   3. a pessoa chega SEM link — o caso do TikTok, onde link em legenda não é
--      clicável e ela digita o endereço do site. Não havia como vincular.
--
-- Com esta coluna, a indicação passa a morar na conta. O checkout usa a
-- indicação salva acima do código do navegador, e o webhook não muda: continua
-- lendo o afiliado dos metadados que o checkout grava, e validando o valor com
-- o mesmo registro de afiliado (a consistência de desconto vem daí).
--
-- WRITE-ONCE: a gravação usa o filtro `referred_by_affiliate_id=is.null`, então
-- a primeira indicação vence e nenhum checkout posterior a troca. Correção
-- manual (source = 'admin') é feita aqui no SQL Editor, pelo dono.
--
-- Segurança: profiles já tem RLS com "select own". O usuário lê a própria
-- indicação e nada mais; a escrita é só do backend (service role), como todo o
-- resto do perfil (ver profiles_restrict_direct_writes.sql).
--
-- Aplicar manualmente no SQL Editor do Supabase (idempotente). Antes de aplicar,
-- o código novo degrada para o comportamento anterior: sem a coluna, a leitura
-- da indicação falha em silêncio e o checkout usa só o código do navegador.

alter table public.profiles
  add column if not exists referred_by_affiliate_id uuid
    references public.affiliates(id) on delete set null;

alter table public.profiles
  add column if not exists referred_at timestamptz;

alter table public.profiles
  add column if not exists referral_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_referral_source_check'
  ) then
    alter table public.profiles
      add constraint profiles_referral_source_check
      check (referral_source is null or referral_source in ('link', 'codigo', 'admin'));
  end if;
end $$;

-- Quadro por afiliado e conferência de quem ele trouxe.
create index if not exists profiles_referred_by_affiliate_id_idx
  on public.profiles (referred_by_affiliate_id)
  where referred_by_affiliate_id is not null;

comment on column public.profiles.referred_by_affiliate_id is
  'Afiliado que indicou esta conta. Write-once: a primeira indicação vence. Usado pelo checkout acima do código do navegador.';
comment on column public.profiles.referral_source is
  'Como a indicação chegou: link (?ref=), codigo (digitado no modal de planos) ou admin (vínculo manual).';
