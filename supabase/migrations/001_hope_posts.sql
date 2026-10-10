-- Run in Supabase SQL Editor (Dashboard → SQL)
create table if not exists public.hope_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  author_name text not null,
  author_avatar text,
  content text not null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hope_posts_created_at_idx on public.hope_posts (created_at desc);
create index if not exists hope_posts_user_id_idx on public.hope_posts (user_id);

alter table public.hope_posts enable row level security;

drop policy if exists "Hope posts are publicly readable" on public.hope_posts;
create policy "Hope posts are publicly readable"
  on public.hope_posts for select
  using (true);

drop policy if exists "Authenticated users can insert own hope posts" on public.hope_posts;
create policy "Authenticated users can insert own hope posts"
  on public.hope_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own hope posts" on public.hope_posts;
create policy "Users can update own hope posts"
  on public.hope_posts for update
  to authenticated
  using (auth.uid() = user_id);
