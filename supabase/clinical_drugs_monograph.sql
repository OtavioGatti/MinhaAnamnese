-- Bula completa do Bulário: seções novas (indicações, mecanismo, ajustes renal
-- e hepático, gestação detalhada, lactação, efeitos adversos, receituário,
-- referências, revisão clínica...) numa coluna jsonb só.
--
-- Uma coluna em vez de ~18: o conteúdo é só exibido (não é filtrado nem
-- buscado), e cada campo novo passa a exigir mudança no sync e na tela, não
-- mais uma migração manual.
--
-- O sync e a API funcionam antes deste SQL ser aplicado: se a coluna não
-- existir, eles gravam/leem sem ela e as seções novas simplesmente não
-- aparecem.

alter table public.clinical_drugs
  add column if not exists monograph jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_drugs_monograph_object_check'
      and conrelid = 'public.clinical_drugs'::regclass
  ) then
    alter table public.clinical_drugs
      add constraint clinical_drugs_monograph_object_check
      check (jsonb_typeof(monograph) = 'object');
  end if;
end $$;
