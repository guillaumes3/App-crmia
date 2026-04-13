-- White-label foundation for tenant routing + branding
-- Run in Supabase SQL Editor before enabling subdomain routing in production.

alter table public.organisations
  add column if not exists slug text,
  add column if not exists custom_domain text,
  add column if not exists logo_url text,
  add column if not exists primary_color text;

-- Backfill slug from name when possible
update public.organisations
set slug = regexp_replace(lower(trim(nom)), '[^a-z0-9]+', '-', 'g')
where coalesce(trim(slug), '') = ''
  and coalesce(trim(nom), '') <> '';

update public.organisations
set slug = trim(both '-' from slug)
where slug is not null;

-- Fallback slug to guarantee a value for existing rows
update public.organisations
set slug = concat('company-', substr(id::text, 1, 8))
where coalesce(trim(slug), '') = '';

-- Ensure case-insensitive uniqueness by adding numeric suffixes to duplicates
with ranked as (
  select
    id,
    slug,
    row_number() over (
      partition by lower(slug)
      order by created_at nulls last, id
    ) as rn
  from public.organisations
)
update public.organisations as o
set slug = case
  when ranked.rn = 1 then ranked.slug
  else concat(ranked.slug, '-', ranked.rn)
end
from ranked
where o.id = ranked.id;

alter table public.organisations
  alter column slug set not null;

alter table public.organisations
  drop constraint if exists organisations_slug_format_check;

alter table public.organisations
  add constraint organisations_slug_format_check
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index if not exists organisations_slug_unique_idx
  on public.organisations (lower(slug));

create unique index if not exists organisations_custom_domain_unique_idx
  on public.organisations (lower(custom_domain))
  where custom_domain is not null and length(trim(custom_domain)) > 0;

-- Prisma model equivalent (proposal)
-- model Company {
--   id            String   @id @default(uuid()) @db.Uuid
--   name          String   @map("nom")
--   slug          String   @unique
--   custom_domain String?  @unique
--   logo_url      String?
--   primary_color String?
--   created_at    DateTime @default(now()) @db.Timestamptz(6)
--   updated_at    DateTime @updatedAt @db.Timestamptz(6)
--
--   @@map("organisations")
-- }
