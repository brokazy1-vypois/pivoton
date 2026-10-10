-- Cached AI broker voice query responses (Gemini + market data)
create table if not exists public.ai_broker_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,
  query_text text not null,
  response text not null,
  tickers text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create index if not exists ai_broker_cache_query_hash_idx on public.ai_broker_cache (query_hash);
create index if not exists ai_broker_cache_expires_at_idx on public.ai_broker_cache (expires_at);

alter table public.ai_broker_cache enable row level security;

drop policy if exists "AI broker cache is publicly readable" on public.ai_broker_cache;
create policy "AI broker cache is publicly readable"
  on public.ai_broker_cache for select
  using (true);

drop policy if exists "AI broker cache can be inserted" on public.ai_broker_cache;
create policy "AI broker cache can be inserted"
  on public.ai_broker_cache for insert
  with check (true);

drop policy if exists "AI broker cache can be updated" on public.ai_broker_cache;
create policy "AI broker cache can be updated"
  on public.ai_broker_cache for update
  using (true)
  with check (true);
