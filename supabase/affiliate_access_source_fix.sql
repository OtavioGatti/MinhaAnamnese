-- Afiliados não estão em teste: corrige o access_source de quem foi promovido.
--
-- Contexto do defeito: o cadastro grava access_source='trial' e
-- plan_expires_at = agora + 7 dias. Promover alguém a afiliado sempre foi um
-- UPDATE manual que mexia SÓ no current_plan, então o perfil continuava
-- parecendo um teste em andamento para sempre — a data nunca era limpa, e a
-- expiração preguiçosa (expireProfileAccessIfNeeded) nunca roda para eles
-- porque exige current_plan='pro'.
--
-- Dois sintomas reais disso:
--   1. Recebiam o e-mail "seu teste profissional termina em breve" / "terminou"
--      (backend/services/trialReminders.js filtrava só por access_source).
--   2. Viam "Teste profissional" e contagem de dias restantes na interface,
--      porque isTrialAccess = hasProfileProAccess && accessSource === 'trial'
--      (backend/services/accessState.js).
--
-- Por que 'legacy' e não um valor novo: o check constraint
-- profiles_access_source_check e normalizeAccessSource aceitam apenas
-- none | trial | paid | legacy. Entre esses, 'legacy' é o que descreve
-- "acesso concedido fora do fluxo de cobrança". 'none' não serve: accessState
-- converte none -> 'paid' na leitura quando há acesso Pro, o que seria mentira.
--
-- Idempotente. Aplicar manualmente no SQL Editor do Supabase.

-- 1) Normaliza quem já foi promovido e ficou com o dado torto.
update public.profiles
set
  access_source = 'legacy',
  -- Carimba os dois lembretes como "já resolvidos". Sem isso, se um dia a data
  -- de expiração for renovada (ou o carimbo limpo), o afiliado voltaria para a
  -- fila. O filtro de plano no código já protege; isto é a segunda trava.
  trial_reminder_2d_sent_at = coalesce(trial_reminder_2d_sent_at, timezone('utc', now())),
  trial_reminder_expired_sent_at = coalesce(trial_reminder_expired_sent_at, timezone('utc', now()))
where current_plan in ('affiliate', 'afiliado')
  and access_source = 'trial';

-- 2) Conferência: deve retornar zero linhas depois do update acima.
select id, email, current_plan, access_source, plan_expires_at
from public.profiles
where current_plan in ('affiliate', 'afiliado')
  and access_source = 'trial';


-- ---------------------------------------------------------------------------
-- PROCEDIMENTO PADRÃO: como promover alguém a afiliado
-- ---------------------------------------------------------------------------
-- Use SEMPRE o comando abaixo (não apenas "set current_plan='affiliate'", que
-- é o que gerou a inconsistência corrigida acima). Trocar o e-mail e rodar:
--
--   update public.profiles
--   set
--     current_plan = 'affiliate',
--     access_source = 'legacy',
--     billing_status = 'inactive',
--     plan_expires_at = null,
--     trial_reminder_2d_sent_at = coalesce(trial_reminder_2d_sent_at, timezone('utc', now())),
--     trial_reminder_expired_sent_at = coalesce(trial_reminder_expired_sent_at, timezone('utc', now()))
--   where lower(email) = 'pessoa@exemplo.com';
--
-- plan_expires_at = null porque o acesso de afiliado não expira: accessState
-- concede Pro por isAffiliate, independente de data e de billing_status.
--
-- Depois disso a pessoa consegue criar o próprio código em /afiliado
-- (POST /api/affiliate exige access_state.isAffiliate, que vem do current_plan).
