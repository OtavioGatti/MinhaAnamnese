-- Incremental category binding for user templates.
-- Lets custom templates inherit clinical prompt/evaluation behavior from a
-- system category while keeping the user's own sections.

alter table public.user_templates
  add column if not exists clinical_category text not null default 'general';

update public.user_templates
set clinical_category = 'general'
where clinical_category is null;

alter table public.user_templates
  drop constraint if exists user_templates_clinical_category_check;

alter table public.user_templates
  add constraint user_templates_clinical_category_check
  check (
    clinical_category in (
      'general',
      'psychiatry',
      'pediatrics',
      'obstetrics',
      'emergency',
      'gynecology',
      'postpartum',
      'triage'
    )
  );
