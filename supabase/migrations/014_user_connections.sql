-- Member connection requests (Connect / Pending / Connected)
-- Run in Supabase SQL Editor

create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id text not null,
  addressee_id text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_connections_no_self check (requester_id <> addressee_id),
  constraint user_connections_unique_pair unique (requester_id, addressee_id)
);

create index if not exists user_connections_requester_idx
  on public.user_connections (requester_id, status);

create index if not exists user_connections_addressee_idx
  on public.user_connections (addressee_id, status);

create index if not exists user_connections_status_idx
  on public.user_connections (status);

alter table public.user_connections enable row level security;

drop policy if exists "Users read own connections" on public.user_connections;
create policy "Users read own connections"
  on public.user_connections for select
  using (
    requester_id = auth.uid()::text
    or addressee_id = auth.uid()::text
  );

drop policy if exists "Users send connection requests" on public.user_connections;
create policy "Users send connection requests"
  on public.user_connections for insert
  to authenticated
  with check (requester_id = auth.uid()::text);

drop policy if exists "Users update own connections" on public.user_connections;
create policy "Users update own connections"
  on public.user_connections for update
  to authenticated
  using (
    requester_id = auth.uid()::text
    or addressee_id = auth.uid()::text
  )
  with check (
    requester_id = auth.uid()::text
    or addressee_id = auth.uid()::text
  );

drop policy if exists "Users delete own connections" on public.user_connections;
create policy "Users delete own connections"
  on public.user_connections for delete
  to authenticated
  using (
    requester_id = auth.uid()::text
    or addressee_id = auth.uid()::text
  );
