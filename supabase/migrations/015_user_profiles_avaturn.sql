-- Avaturn 3D avatar GLB URL for map markers
alter table public.user_profiles
  add column if not exists avatar_glb_url text;

alter table public.user_profiles
  add column if not exists avatar_glb_updated_at timestamptz;
