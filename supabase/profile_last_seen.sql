-- Carimbo de última atividade real do usuário, para o painel de métricas
-- responder "as pessoas estão voltando?".
--
-- POR QUE AQUI E NÃO EM auth.users:
--
-- A pergunta natural seria ler `auth.users.last_sign_in_at`, mas expor esse
-- schema é perigoso e desnecessário. Uma view sobre auth.users criada no SQL
-- Editor roda com os privilégios do dono (postgres) e ATRAVESSA a RLS das
-- tabelas de baixo; nascendo no schema public, ela ainda herda os default
-- privileges que dão SELECT a `anon` — e a chave anon está no bundle do
-- frontend, é pública por definição. Somando: qualquer pessoa leria a tabela
-- inteira. E auth.users guarda `recovery_token` e `reauthentication_token`,
-- que são credenciais vivas, não hashes: vazá-las é tomada de conta.
--
-- Esta coluna vive em profiles, que já tem RLS com "select own", então herda
-- a proteção existente. O backend escreve via service role, como todo o
-- resto do perfil (ver profiles_restrict_direct_writes.sql).
--
-- Além de mais seguro, mede melhor: last_sign_in_at só marca sessão NOVA, e
-- some com quem fica logado por semanas. last_seen_at marca volta de verdade.
--
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- O painel filtra por janela de tempo (hoje / 7 dias / 30 dias) sobre a
-- coluna; sem índice isso vira varredura completa conforme a base cresce.
create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

comment on column public.profiles.last_seen_at is
  'Última requisição autenticada atendida pelo backend. Atualizado no máximo 1x por hora (ver touchLastSeen em backend/services/profiles.js). É piso de atividade: quem abre o site sem disparar chamada autenticada não atualiza o carimbo.';
