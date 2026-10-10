-- Direct messaging: conversations, participants, messages (Supabase Realtime)
-- Run in Supabase SQL Editor

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id text not null,
  display_name text not null default '',
  display_avatar text not null default '',
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id text not null,
  sender_name text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Participants can read their conversations
drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()::text
    )
  );

drop policy if exists "Authenticated users create conversations" on public.conversations;
create policy "Authenticated users create conversations"
  on public.conversations for insert
  to authenticated
  with check (true);

drop policy if exists "Participants update conversations" on public.conversations;
create policy "Participants update conversations"
  on public.conversations for update
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()::text
    )
  );

-- Participants
drop policy if exists "Participants read membership" on public.conversation_participants;
create policy "Participants read membership"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()::text
    )
  );

drop policy if exists "Authenticated users join conversations" on public.conversation_participants;
create policy "Authenticated users join conversations"
  on public.conversation_participants for insert
  to authenticated
  with check (true);

drop policy if exists "Users update own read state" on public.conversation_participants;
create policy "Users update own read state"
  on public.conversation_participants for update
  using (user_id = auth.uid()::text);

-- Messages
drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()::text
    )
  );

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()::text
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()::text
    )
  );

-- Realtime: enable the messages table in Supabase Dashboard → Database → Replication
