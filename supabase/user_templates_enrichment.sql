-- Enriquecimento por IA dos templates próprios: metadados por seção (aliases,
-- evidências, orientações, prioridade) gerados no momento de salvar, para o
-- template custom se aproximar da qualidade dos oficiais no score e na
-- organização. Opcional: sem esta coluna, o código cai na herança por
-- similaridade com os templates oficiais.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

alter table public.user_templates
  add column if not exists enrichment jsonb;
