-- Ideation prototypes, ratings, and comments
create table if not exists public.ideation_prototypes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  author_name text not null,
  author_avatar text,
  title text not null default 'Untitled prototype',
  description text not null default '',
  html_preview text not null default '',
  recommended_api_ids jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ideation_prototypes_user_id_idx
  on public.ideation_prototypes (user_id);

create index if not exists ideation_prototypes_published_idx
  on public.ideation_prototypes (is_published, published_at desc nulls last);

create table if not exists public.ideation_ratings (
  id uuid primary key default gen_random_uuid(),
  prototype_id uuid not null references public.ideation_prototypes (id) on delete cascade,
  user_id text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  unique (prototype_id, user_id)
);

create index if not exists ideation_ratings_prototype_id_idx
  on public.ideation_ratings (prototype_id);

create table if not exists public.ideation_comments (
  id uuid primary key default gen_random_uuid(),
  prototype_id uuid not null references public.ideation_prototypes (id) on delete cascade,
  user_id text not null,
  author_name text not null,
  author_avatar text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ideation_comments_prototype_id_idx
  on public.ideation_comments (prototype_id, created_at desc);

alter table public.ideation_prototypes enable row level security;
alter table public.ideation_ratings enable row level security;
alter table public.ideation_comments enable row level security;

drop policy if exists "Published prototypes are publicly readable" on public.ideation_prototypes;
create policy "Published prototypes are publicly readable"
  on public.ideation_prototypes for select
  using (is_published = true or user_id = auth.uid()::text);

drop policy if exists "Users manage own prototypes" on public.ideation_prototypes;
create policy "Users manage own prototypes"
  on public.ideation_prototypes for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "Users update own prototypes"
  on public.ideation_prototypes for update
  to authenticated
  using (user_id = auth.uid()::text);

create policy "Users delete own prototypes"
  on public.ideation_prototypes for delete
  to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Ratings are publicly readable" on public.ideation_ratings;
create policy "Ratings are publicly readable"
  on public.ideation_ratings for select
  using (true);

drop policy if exists "Users manage own ratings" on public.ideation_ratings;
create policy "Users manage own ratings"
  on public.ideation_ratings for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "Users update own ratings"
  on public.ideation_ratings for update
  to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Comments are publicly readable" on public.ideation_comments;
create policy "Comments are publicly readable"
  on public.ideation_comments for select
  using (true);

drop policy if exists "Authenticated users can comment" on public.ideation_comments;
create policy "Authenticated users can comment"
  on public.ideation_comments for insert
  to authenticated
  with check (user_id = auth.uid()::text);
