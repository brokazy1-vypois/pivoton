-- Pivoton Goal Tracker — run once in Supabase Dashboard → SQL Editor
-- Creates goals, goal_milestones, ai_guidance_notes, step_chats + RLS
-- Sources: migrations 018, 020, 021

-- ── Core goal tables ──────────────────────────────────────────────────────
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  post_id text not null,
  title text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists goals_post_id_idx on public.goals (post_id);

create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  order_index int not null default 0
);

create index if not exists goal_milestones_goal_id_idx on public.goal_milestones (goal_id);

create table if not exists public.ai_guidance_notes (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  instruction_text text not null,
  suggested_next_step text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_guidance_notes_goal_id_idx on public.ai_guidance_notes (goal_id);

-- ── Step proofs & discuss-step chat ───────────────────────────────────────
alter table public.goal_milestones
  add column if not exists criteria text,
  add column if not exists proof_url text,
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected'));

create table if not exists public.step_chats (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.goal_milestones (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now(),
  attachment_url text,
  attachment_type text
    check (attachment_type is null or attachment_type in ('image', 'document')),
  attachment_name text
);

create index if not exists step_chats_milestone_id_idx on public.step_chats (milestone_id);

-- Ensure step_chats role constraint allows system messages (021)
alter table public.step_chats drop constraint if exists step_chats_role_check;
alter table public.step_chats
  add constraint step_chats_role_check
  check (role in ('user', 'assistant', 'system'));

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.ai_guidance_notes enable row level security;
alter table public.step_chats enable row level security;

drop policy if exists "Goals are publicly readable" on public.goals;
create policy "Goals are publicly readable"
  on public.goals for select using (true);

drop policy if exists "Users manage own goals" on public.goals;
create policy "Users manage own goals"
  on public.goals for insert to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "Users update own goals" on public.goals;
create policy "Users update own goals"
  on public.goals for update to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Users delete own goals" on public.goals;
create policy "Users delete own goals"
  on public.goals for delete to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Goal milestones are publicly readable" on public.goal_milestones;
create policy "Goal milestones are publicly readable"
  on public.goal_milestones for select using (true);

drop policy if exists "Users manage milestones on own goals" on public.goal_milestones;
create policy "Users manage milestones on own goals"
  on public.goal_milestones for all to authenticated
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = auth.uid()::text
    )
  );

drop policy if exists "AI guidance notes are publicly readable" on public.ai_guidance_notes;
create policy "AI guidance notes are publicly readable"
  on public.ai_guidance_notes for select using (true);

drop policy if exists "Users manage guidance on own goals" on public.ai_guidance_notes;
create policy "Users manage guidance on own goals"
  on public.ai_guidance_notes for all to authenticated
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = auth.uid()::text
    )
  );

drop policy if exists "Step chats are publicly readable" on public.step_chats;
create policy "Step chats are publicly readable"
  on public.step_chats for select using (true);

drop policy if exists "Users manage chats on own goal milestones" on public.step_chats;
create policy "Users manage chats on own goal milestones"
  on public.step_chats for all to authenticated
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

-- Reload PostgREST schema cache so API sees new tables immediately
notify pgrst, 'reload schema';
