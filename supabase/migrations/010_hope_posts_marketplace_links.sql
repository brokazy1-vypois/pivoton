-- Store multiple marketplace product links per hope post
alter table public.hope_posts
  add column if not exists marketplace_links jsonb not null default '[]'::jsonb;

-- Backfill from legacy single-link column when present
update public.hope_posts
set marketplace_links = jsonb_build_array(marketplace_link)
where marketplace_link is not null
  and marketplace_link <> ''
  and (marketplace_links is null or marketplace_links = '[]'::jsonb);
