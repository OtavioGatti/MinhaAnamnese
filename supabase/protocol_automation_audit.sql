-- Auditoria da automação de protocolos de prescrição.
-- Sem esta tabela aplicada, o backend faz fallback para arquivo JSONL local
-- (efêmero no Render) e ainda devolve as entradas na resposta HTTP.
-- Aplicar manualmente no SQL Editor do Supabase (idempotente).

create table if not exists public.protocol_automation_audit (
  id uuid primary key default gen_random_uuid(),
  page_id text,
  titulo text,
  action text,                      -- 'gerar' | 'corrigir'
  source text not null default 'automacao',  -- 'automacao' | 'manual'
  ok boolean not null default true,
  changed_fields jsonb not null default '[]'::jsonb,
  status_automacao text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.protocol_automation_audit enable row level security;

-- Sem policies: apenas o service role (que ignora RLS) grava/lê esta tabela.

create index if not exists protocol_automation_audit_page_idx
  on public.protocol_automation_audit (page_id);

create index if not exists protocol_automation_audit_created_idx
  on public.protocol_automation_audit (created_at desc);
