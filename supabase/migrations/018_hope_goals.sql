-- Hope-to-Goal timeline tracker
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

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.ai_guidance_notes enable row level security;

drop policy if exists "Goals are publicly readable" on public.goals;
create policy "Goals are publicly readable"
  on public.goals for select
  using (true);

drop policy if exists "Users manage own goals" on public.goals;
create policy "Users manage own goals"
  on public.goals for insert
  to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "Users update own goals" on public.goals;
create policy "Users update own goals"
  on public.goals for update
  to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Users delete own goals" on public.goals;
create policy "Users delete own goals"
  on public.goals for delete
  to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists "Goal milestones are publicly readable" on public.goal_milestones;
create policy "Goal milestones are publicly readable"
  on public.goal_milestones for select
  using (true);

drop policy if exists "Users manage milestones on own goals" on public.goal_milestones;
create policy "Users manage milestones on own goals"
  on public.goal_milestones for all
  to authenticated
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
  on public.ai_guidance_notes for select
  using (true);

drop policy if exists "Users manage guidance on own goals" on public.ai_guidance_notes;
create policy "Users manage guidance on own goals"
  on public.ai_guidance_notes for all
  to authenticated
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
