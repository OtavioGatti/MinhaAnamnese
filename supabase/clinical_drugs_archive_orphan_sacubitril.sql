-- Arquiva a linha órfã `sacubitril-valsartana`.
-- A página do Notion dela foi apagada (404), então o sync nunca mais a
-- atualiza e ela seguia publicada ao lado de `associacao-sacubitril-valsartana`,
-- a cópia mantida. Nenhum par de interação aponta para o slug órfão.
-- Idempotente: rodar de novo não muda nada.
update public.clinical_drugs
set publication_status = 'archived'
where slug = 'sacubitril-valsartana'
  and notion_page_id = '369da8a9-2980-8182-8679-f404c9413eaa'
  and publication_status <> 'archived';
