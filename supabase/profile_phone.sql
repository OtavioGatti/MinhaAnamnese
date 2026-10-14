-- Celular no cadastro (contato por WhatsApp) e aceite de mensagens.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).
--
-- phone: só os 11 dígitos, DDD + número (ex.: 11987654321), já validados pelo
--   backend (backend/utils/phone.js). A trava abaixo repete o formato no banco.
-- phone_collected_at: quando o número foi informado ou trocado.
-- whatsapp_opt_in_at: quando a pessoa aceitou receber mensagens; null = não
--   aceitou (ou retirou o aceite no perfil).
--
-- Leitura: a RLS de profiles (profiles_select_own) só deixa cada usuário ver a
-- própria linha; escrita só pelo backend (service role). Não criar view sobre
-- estas colunas: o anon tem SELECT nas tabelas de public e só a RLS protege.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_collected_at timestamptz,
  add column if not exists whatsapp_opt_in_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_format_check
      check (phone is null or phone ~ '^[1-9]{2}9[0-9]{8}$');
  end if;
end $$;

-- Conferência depois de aplicar:
--   select count(*) filter (where phone is not null) as com_celular,
--          count(*) filter (where whatsapp_opt_in_at is not null) as aceitam_whatsapp
--   from public.profiles;
