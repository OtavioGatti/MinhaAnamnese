-- Adds CID-10 metadata for prescription guides and their internal prescription options.
-- Run this once in the Supabase SQL editor before deploying the code that reads
-- cid10_primary and prescription_option_cids.

create extension if not exists pg_trgm with schema extensions;

alter table public.prescription_guides
  add column if not exists cid10_primary text,
  add column if not exists prescription_option_cids jsonb not null default '{}'::jsonb;

update public.prescription_guides
set prescription_option_cids = '{}'::jsonb
where prescription_option_cids is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prescription_guides_option_cids_object_check'
  ) then
    alter table public.prescription_guides
      add constraint prescription_guides_option_cids_object_check
      check (jsonb_typeof(prescription_option_cids) = 'object');
  end if;
end $$;

create index if not exists prescription_guides_cid10_primary_trgm_idx
  on public.prescription_guides using gin (cid10_primary extensions.gin_trgm_ops);
