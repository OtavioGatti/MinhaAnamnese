-- Dicas do produto (balões contextuais) que a pessoa já fechou.
-- Lista de ids curtos, ex.: ["frases_pronta","arroba"]. Fica no perfil para
-- não voltar em outro aparelho. Idempotente.
alter table public.profiles
  add column if not exists tips_seen jsonb not null default '[]'::jsonb;
