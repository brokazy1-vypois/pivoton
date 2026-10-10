-- One-shot Supabase setup for profile avatars + Avaturn GLB uploads
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- Avatar columns on user_profiles
alter table public.user_profiles
  add column if not exists avatar_image_url text;
alter table public.user_profiles
  add column if not exists avatar_media_type text;
alter table public.user_profiles
  add column if not exists avatar_crop jsonb;
alter table public.user_profiles
  add column if not exists avatar_glb_url text;
alter table public.user_profiles
  add column if not exists avatar_glb_updated_at timestamptz;

-- Storage bucket (public read, authenticated write under {userId}/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-attachments',
  'post-attachments',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'model/gltf-binary', 'application/octet-stream',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS
drop policy if exists "Post attachments are publicly readable" on storage.objects;
create policy "Post attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-attachments');

drop policy if exists "Users can upload own post attachments" on storage.objects;
create policy "Users can upload own post attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own post attachments" on storage.objects;
create policy "Users can update own post attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'post-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own post attachments" on storage.objects;
create policy "Users can delete own post attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- user_profiles upsert for avatar metadata
drop policy if exists "Authenticated users upsert own profile" on public.user_profiles;
create policy "Authenticated users upsert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = auth.uid()::text);

drop policy if exists "Authenticated users update own profile" on public.user_profiles;
create policy "Authenticated users update own profile"
  on public.user_profiles for update
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
