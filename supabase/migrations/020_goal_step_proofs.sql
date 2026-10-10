-- Goal step proofs, criteria, and negotiation chat
alter table public.goal_milestones
  add column if not exists criteria text,
  add column if not exists proof_url text,
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected'));

create table if not exists public.step_chats (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.goal_milestones (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists step_chats_milestone_id_idx on public.step_chats (milestone_id);

alter table public.step_chats enable row level security;

drop policy if exists "Step chats are publicly readable" on public.step_chats;
create policy "Step chats are publicly readable"
  on public.step_chats for select
  using (true);

drop policy if exists "Users manage chats on own goal milestones" on public.step_chats;
create policy "Users manage chats on own goal milestones"
  on public.step_chats for all
  to authenticated
  using (
    exists (
      select 1
      from public.goal_milestones m
      join public.goals g on g.id = m.goal_id
      where m.id = milestone_id and g.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.goal_milestones m
      join public.goals g on g.id = m.goal_id
      where m.id = milestone_id and g.user_id = auth.uid()::text
    )
  );
