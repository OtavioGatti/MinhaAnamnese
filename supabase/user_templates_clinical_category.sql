-- Incremental category binding for user templates.
-- Lets custom templates inherit clinical prompt/evaluation behavior from a
-- system category while keeping the user's own sections.

alter table public.user_templates
  add column if not exists clinical_category text,
  add column if not exists clinical_category_key text not null default 'clinica_medica',
  add column if not exists clinical_category_label text not null default 'Clínica médica';

alter table public.user_templates
  alter column clinical_category drop not null;

update public.user_templates
set
  clinical_category_key = case clinical_category
    when 'psychiatry' then 'saude_mental'
    when 'pediatrics' then 'pediatria'
    when 'obstetrics' then 'obstetricia'
    when 'emergency' then 'urgencia_e_emergencia'
    when 'gynecology' then 'ginecologia'
    when 'postpartum' then 'puerperio'
    when 'triage' then 'triagem'
    else 'clinica_medica'
  end,
  clinical_category_label = case clinical_category
    when 'psychiatry' then 'Saúde mental'
    when 'pediatrics' then 'Pediatria'
    when 'obstetrics' then 'Obstetrícia'
    when 'emergency' then 'Urgência e emergência'
    when 'gynecology' then 'Ginecologia'
    when 'postpartum' then 'Puerpério'
    when 'triage' then 'Triagem'
    else 'Clínica médica'
  end
where clinical_category_key is null
   or clinical_category_label is null
   or (
     clinical_category is not null
     and (
       clinical_category_key = 'clinica_medica'
       or clinical_category_label = 'Clínica médica'
     )
   );

alter table public.user_templates
  drop constraint if exists user_templates_clinical_category_check;
