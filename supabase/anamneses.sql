create table if not exists public.anamneses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null,
  score double precision not null,
  text_length integer not null,
  has_teaser boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists anamneses_user_id_idx
  on public.anamneses (user_id);

create index if not exists anamneses_template_idx
  on public.anamneses (template);

create index if not exists anamneses_created_at_idx
  on public.anamneses (created_at desc);
