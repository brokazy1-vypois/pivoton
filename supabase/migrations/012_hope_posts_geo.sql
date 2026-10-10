-- Geo coordinates for location-based hope discovery
alter table public.hope_posts
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_label text;

create index if not exists hope_posts_latitude_idx on public.hope_posts (latitude);
create index if not exists hope_posts_longitude_idx on public.hope_posts (longitude);
