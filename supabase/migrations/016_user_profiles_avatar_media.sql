-- Profile avatar media (image, GIF, or short video)
alter table public.user_profiles
  add column if not exists avatar_image_url text;

alter table public.user_profiles
  add column if not exists avatar_media_type text;

alter table public.user_profiles
  add column if not exists avatar_crop jsonb;
