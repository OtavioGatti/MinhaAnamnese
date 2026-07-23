-- Preferência de estilo de escrita da saída (anamnese organizada): "mixed"
-- (Aa, texto normal como a IA já escreve) ou "upper" (AA, tudo em maiúsculas —
-- formato que parte dos médicos usa por padrão). Aplicar manualmente no SQL
-- Editor do Supabase (idempotente).

alter table public.profiles
  add column if not exists output_case_style text not null default 'mixed';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_output_case_style_check'
  ) then
    alter table public.profiles
      add constraint profiles_output_case_style_check
      check (output_case_style in ('mixed', 'upper'));
  end if;
end $$;
