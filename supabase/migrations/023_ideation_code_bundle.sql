-- Executable code bundles and deployment metadata for ideation prototypes
alter table public.ideation_prototypes
  add column if not exists code_bundle jsonb not null default '{}'::jsonb,
  add column if not exists env_vars jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists monetization_tier text not null default 'free';

create index if not exists ideation_prototypes_status_idx
  on public.ideation_prototypes (status, published_at desc nulls last);
