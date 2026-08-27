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
--
-- CONTRATO: a funcao NAO remove acento. As colunas search_text e
-- description_search ja estao sem acento (normalizadas na importacao), entao
-- quem chama precisa mandar o termo sem acento tambem — o backend faz isso em
-- normalizeQuery (services/cid10.js). Testar direto no SQL Editor com acento
-- devolve zero resultado e parece bug, mas e so a entrada fora do contrato.
--
-- DUAS PASSADAS. A primeira e literal (LIKE) e responde em ~11ms. So quando ela
-- volta fraca entra a segunda, por parecenca de trigrama (word_similarity), que
-- custa ~150ms porque calcula similaridade nas 14 mil linhas. Como a busca roda
-- a cada tecla digitada, pagar o trigrama sempre seria 15x mais lento no caso
-- comum; pagar so quando o literal falhou e justamente quando o medico esta sem
-- resposta e prefere esperar.
--
-- E a segunda passada que faz "dislipidemia" chegar em "Disturbios do
-- metabolismo de lipoproteinas e outras lipidemias" — descricao oficial que nao
-- contem o termo digitado. Usa word_similarity e nao similarity porque o termo e
-- curto e a descricao e longa: similarity() compara as strings inteiras e
-- afundaria qualquer termo de uma palavra so.
create or replace function public.search_cid10_codes(
  search_query text,
  max_results integer default 20
)
returns setof public.cid10_codes
language plpgsql
stable
as $$
declare
  -- Curinga do LIKE vindo da entrada viraria busca aberta: fora.
  termo text := lower(btrim(replace(replace(coalesce(search_query, ''), '%', ''), '_', '')));
  codigo text;
  padrao_ordenado text;
  cap integer := greatest(least(coalesce(max_results, 20), 50), 1);
  achados integer;
begin
  if length(termo) < 2 then
    return;
  end if;

  codigo := upper(replace(replace(termo, '.', ''), ' ', ''));

  -- Palavras de conteudo na ordem, conectivos ignorados. A IA escreve "Doenca DO
  -- Refluxo Gastroesofagico" e a tabela oficial diz "Doenca DE refluxo
  -- gastroesofagico": sem isso, uma preposicao diferente zera a busca. So os
  -- conectivos saem — todos os termos clinicos continuam obrigatorios, e na
  -- mesma ordem, para nao casar com outra condicao.
  select '%' || coalesce(string_agg(palavra.w, '%' order by palavra.ord), termo) || '%'
    into padrao_ordenado
  from unnest(string_to_array(termo, ' ')) with ordinality as palavra(w, ord)
  where palavra.w <> ''
    and palavra.w not in (
      'de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'na', 'no', 'nas', 'nos',
      'em', 'por', 'para', 'ao', 'aos', 'e', 'a', 'o', 'as', 'os'
    );

  return query
  select codes.*
  from public.cid10_codes codes
  where codes.code_key like codigo || '%'
     or codes.search_text like '%' || termo || '%'
     or codes.description_search like padrao_ordenado
  order by
    case
      when codes.code_key = codigo then 0
      when codes.code_key like codigo || '%' then 1
      when codes.description_search like termo || '%' then 2
      -- Termo no comeco de outra palavra: "aereas" em "vias aereas".
      when codes.description_search like '% ' || termo || '%' then 3
      when codes.search_text like '%' || termo || '%' then 4
      -- Bateu so ignorando conectivo. E o resultado mais frouxo da passada
      -- literal, entao nunca passa na frente de quem casou com a frase inteira.
      else 5
    end,
    -- Entre iguais, a descricao mais curta costuma ser a mais geral.
    length(codes.description),
    codes.code_key
  limit cap;

  get diagnostics achados = row_count;

  -- Cinco ja e meia tela de sugestao: a passada cara so vale a pena abaixo disso.
  if achados >= 5 then
    return;
  end if;

  return query
  select codes.*
  from public.cid10_codes codes
  where word_similarity(termo, codes.description_search) >= 0.5
    -- Sem isto, o que a passada literal ja devolveu voltaria duplicado.
    and not (
      codes.code_key like codigo || '%'
      or codes.search_text like '%' || termo || '%'
      or codes.description_search like padrao_ordenado
    )
  order by
    word_similarity(termo, codes.description_search) desc,
    length(codes.description),
    codes.code_key
  limit cap - achados;
end;
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
