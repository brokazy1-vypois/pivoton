-- Post-call executive summaries & transcripts per private room
create table if not exists public.call_summaries (
  id text primary key,
  room_id text not null,
  broker_name text not null,
  user_id text not null,
  full_transcript text not null default '',
  summary_markdown text not null default '',
  extracted_tickers jsonb not null default '[]'::jsonb,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists call_summaries_room_id_idx on public.call_summaries (room_id);
create index if not exists call_summaries_created_at_idx on public.call_summaries (created_at desc);

alter table public.call_summaries enable row level security;

drop policy if exists "Call summaries are publicly readable" on public.call_summaries;
create policy "Call summaries are publicly readable"
  on public.call_summaries for select
  using (true);

drop policy if exists "Authenticated users can insert call summaries" on public.call_summaries;
create policy "Authenticated users can insert call summaries"
  on public.call_summaries for insert
  to authenticated
  with check (true);
