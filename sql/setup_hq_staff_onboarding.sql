-- HQ staff onboarding schema hardening
-- Run this script in Supabase SQL Editor.

alter table public.profiles
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists matricule_interne text;

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_matricule_interne_idx on public.profiles (matricule_interne);
