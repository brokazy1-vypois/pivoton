drop policy if exists "Authenticated users can insert hope comments" on public.hope_comments;
create policy "Authenticated users can insert hope comments"
  on public.hope_comments for insert
  to authenticated
  with check (auth.uid()::text = user_id);
