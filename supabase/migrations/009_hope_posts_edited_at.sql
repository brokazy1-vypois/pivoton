-- Track hope post edits
alter table public.hope_posts
  add column if not exists edited_at timestamptz;

drop policy if exists "Users can delete own hope posts" on public.hope_posts;
create policy "Users can delete own hope posts"
  on public.hope_posts for delete
  to authenticated
  using (auth.uid() = user_id);
