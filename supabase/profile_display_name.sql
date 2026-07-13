-- Nome de exibição do usuário (opcional, editável no Perfil). Substitui o
-- heurístico feio derivado do e-mail no chip do topo. Aplicar manualmente no
-- SQL Editor do Supabase (idempotente).

alter table public.profiles
  add column if not exists display_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_display_name_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_length_check
      check (display_name is null or char_length(display_name) between 1 and 60);
  end if;
end $$;
