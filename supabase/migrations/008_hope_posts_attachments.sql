-- Hope feed attachments + marketplace link metadata
--
-- MANUAL SETUP (if uploads fail with "Bucket not found"):
-- 1. Supabase Dashboard → SQL Editor → paste and run this entire file.
-- 2. Or: Storage → New bucket → Name: post-attachments → Public: ON → Create.
--    Then run only the RLS policy section below (from "drop policy if exists").
-- 3. Optional .env: NEXT_PUBLIC_SUPABASE_POST_ATTACHMENTS_BUCKET=post-attachments
alter table public.hope_posts
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists marketplace_link text;

-- Dedicated bucket for hope post media (images, GIFs, videos, documents)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-attachments',
  'post-attachments',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

drop policy if exists "Users can delete own post attachments" on storage.objects;
create policy "Users can delete own post attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
