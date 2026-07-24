-- Generaliza a auditoria de automação para cobrir mais de um tipo de recurso
-- (protocolos de prescrição e, agora, bulário/medicamentos). Adiciona a coluna
-- resource_type na tabela existente protocol_automation_audit, mantendo o nome
-- físico da tabela (renomear em produção não é idempotente/seguro). Aplicar
-- manualmente no SQL Editor do Supabase (idempotente).

alter table public.protocol_automation_audit
  add column if not exists resource_type text not null default 'protocol';

create index if not exists protocol_automation_audit_resource_idx
  on public.protocol_automation_audit (resource_type, created_at desc);
