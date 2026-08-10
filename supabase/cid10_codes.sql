-- Tabela CID-10 (DATASUS/CBCD) usada como referencia pesquisavel pelo medico.
--
-- Diferente dos outros catalogos, este NAO vem do Notion: e a tabela oficial do
-- governo, importada uma vez por tools/import_cid10_supabase.py. Nao ha
-- curadoria editorial por linha aqui — a descricao e copiada da fonte oficial,
-- entao o CMS nao agregaria nada e 14 mil linhas sufocariam a API do Notion.
--
-- O medico pesquisa e escolhe o codigo; a IA nunca sugere CID (ver o contrato
-- de seguranca em backend/prompts/diagnosticHypothesesPrompt.js).

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.cid10_codes (
  -- Forma de exibicao e de uso no documento: "N30.0" (subcategoria) ou "A09"
  -- (categoria). E a mesma string que o medico cola no atestado.
  code text primary key,
  -- Sem ponto ("N300"): permite buscar por prefixo digitando "n30" ou "n300".
  code_key text not null,
  description text not null,
  -- Minusculas e sem acento, calculado na importacao. Evita depender da
  -- extensao unaccent no runtime da busca.
  search_text text not null,
  -- So a descricao normalizada. Separada do search_text (que comeca pelo
  -- codigo) para o ranking conseguir perguntar "a descricao COMECA com o
  -- termo?" — e o que separa "Cistite aguda" de "Colecistite" numa busca
  -- por "cistite".
  description_search text,
  -- Categoria de 3 caracteres a que o codigo pertence ("N30" para "N30.0").
  category_code text not null,
  chapter_number smallint,
  chapter_description text,
  group_description text,
  level text not null,
  -- Restricao de sexo declarada pela fonte ('F' ou 'M'), quando houver.
  sex_restriction text,
  -- Convencao adaga/asterisco da CID-10: '+' e etiologia, '*' e manifestacao.
  -- Codigo com '*' nao deve ser usado sozinho como diagnostico principal.
  dagger_asterisk text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cid10_codes_level_check
    check (level in ('categoria', 'subcategoria')),
  constraint cid10_codes_sex_restriction_check
    check (sex_restriction is null or sex_restriction in ('F', 'M')),
  constraint cid10_codes_dagger_asterisk_check
    check (dagger_asterisk is null or dagger_asterisk in ('+', '*')),
  constraint cid10_codes_description_not_empty_check
    check (char_length(trim(description)) > 0)
);

alter table public.cid10_codes
  add column if not exists code_key text,
  add column if not exists description text,
  add column if not exists search_text text,
  add column if not exists description_search text,
  add column if not exists category_code text,
  add column if not exists chapter_number smallint,
  add column if not exists chapter_description text,
  add column if not exists group_description text,
  add column if not exists level text,
  add column if not exists sex_restriction text,
  add column if not exists dagger_asterisk text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Busca por termo ("cistite"): substring sobre o texto ja normalizado.
create index if not exists cid10_codes_search_text_trgm_idx
  on public.cid10_codes using gin (search_text extensions.gin_trgm_ops);

-- Busca por codigo ("n30"): prefixo, por isso text_pattern_ops.
create index if not exists cid10_codes_code_key_prefix_idx
  on public.cid10_codes (code_key text_pattern_ops);

create index if not exists cid10_codes_category_idx
  on public.cid10_codes (category_code);

-- "a descricao comeca com o termo?" e uma das perguntas do ranking.
create index if not exists cid10_codes_description_search_prefix_idx
  on public.cid10_codes (description_search text_pattern_ops);

-- Relevancia decidida no banco, nao no backend. Sem isso, buscar "infeccao"
-- (96 resultados) devolveria so os primeiros codigos em ordem alfabetica —
-- todos do capitulo A — e nunca chegaria em J06.9, que e o que o medico quer.
create or replace function public.search_cid10_codes(
  search_query text,
  max_results integer default 20
)
returns setof public.cid10_codes
language sql
stable
as $$
  with normalized as (
    select
      -- Curinga do LIKE vindo da entrada viraria busca aberta: fora.
      lower(btrim(replace(replace(coalesce(search_query, ''), '%', ''), '_', ''))) as term,
      upper(replace(replace(btrim(replace(replace(coalesce(search_query, ''), '%', ''), '_', '')), '.', ''), ' ', '')) as code
  )
  select codes.*
  from public.cid10_codes codes, normalized
  where length(normalized.term) >= 2
    and (
      codes.code_key like normalized.code || '%'
      or codes.search_text like '%' || normalized.term || '%'
    )
  order by
    case
      when codes.code_key = normalized.code then 0
      when codes.code_key like normalized.code || '%' then 1
      when codes.description_search like normalized.term || '%' then 2
      -- Termo no comeco de outra palavra: "aereas" em "vias aereas".
      when codes.description_search like '% ' || normalized.term || '%' then 3
      else 4
    end,
    -- Entre iguais, a descricao mais curta costuma ser a mais geral.
    length(codes.description),
    codes.code_key
  limit greatest(least(coalesce(max_results, 20), 50), 1);
$$;

grant execute on function public.search_cid10_codes(text, integer) to authenticated, service_role;

create or replace function public.set_cid10_codes_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = timezone(''utc'', now());
  return new;
end;
';

drop trigger if exists set_cid10_codes_updated_at on public.cid10_codes;
create trigger set_cid10_codes_updated_at
before update on public.cid10_codes
for each row
execute function public.set_cid10_codes_updated_at();

alter table public.cid10_codes enable row level security;

-- Mesmo gate dos guias de prescricao: a busca de CID vive dentro da aba de
-- Prescricoes e do gerador de atestado, ambos do plano profissional.
drop policy if exists cid10_codes_select_paid_professional on public.cid10_codes;
create policy cid10_codes_select_paid_professional
  on public.cid10_codes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.current_plan = 'pro'
        and profiles.billing_status = 'active'
        and (
          profiles.plan_expires_at is null
          or profiles.plan_expires_at > timezone('utc', now())
        )
    )
  );
