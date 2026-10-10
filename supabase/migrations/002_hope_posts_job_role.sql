-- Optional columns for richer hope feed metadata
alter table public.hope_posts
  add column if not exists job_role text,
  add column if not exists hope_status text check (hope_status in ('fulfilled', 'in_progress'));
