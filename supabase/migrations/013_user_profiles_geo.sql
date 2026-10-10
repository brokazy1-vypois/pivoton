-- Registered user home / map locations for Contact Search
create table if not exists public.user_profiles (
  user_id text primary key,
  full_name text not null default '',
  avatar text not null default '',
  latitude double precision,
  longitude double precision,
  city text,
  region text,
  address_line text,
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_lat_idx on public.user_profiles (latitude);
create index if not exists user_profiles_lng_idx on public.user_profiles (longitude);

alter table public.user_profiles enable row level security;

drop policy if exists "User profiles are publicly readable" on public.user_profiles;
create policy "User profiles are publicly readable"
  on public.user_profiles for select
  using (true);

drop policy if exists "Authenticated users upsert own profile" on public.user_profiles;
create policy "Authenticated users upsert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "Authenticated users update own profile" on public.user_profiles;
create policy "Authenticated users update own profile"
  on public.user_profiles for update
  to authenticated
  using (user_id = auth.uid()::text);
