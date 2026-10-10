-- Threaded comments on hope feed posts (local seed IDs use text keys)
create table if not exists public.hope_comments (
  id text primary key,
  post_id text not null,
  parent_id text,
  user_id text not null,
  author_name text not null,
  author_avatar text,
  job_role text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists hope_comments_post_id_idx on public.hope_comments (post_id);
create index if not exists hope_comments_parent_id_idx on public.hope_comments (parent_id);

alter table public.hope_comments enable row level security;

drop policy if exists "Hope comments are publicly readable" on public.hope_comments;
create policy "Hope comments are publicly readable"
  on public.hope_comments for select
  using (true);
