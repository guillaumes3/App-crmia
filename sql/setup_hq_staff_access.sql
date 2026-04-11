-- HQ staff access fields for profiles
-- Run this script in Supabase SQL Editor.

alter table public.profiles
  add column if not exists is_hq_staff boolean not null default false,
  add column if not exists role_hq text;

create index if not exists profiles_hq_staff_idx on public.profiles (is_hq_staff);
create index if not exists profiles_hq_role_idx on public.profiles (role_hq);
