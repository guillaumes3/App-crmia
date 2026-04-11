-- Force update login foundations for HQ access
-- Target user: guillaume@kipilote.com
-- Run in Supabase SQL Editor.

begin;

alter table public.profiles
  add column if not exists is_hq_staff boolean not null default false,
  add column if not exists role_hq text,
  add column if not exists matricule text,
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists profiles_auth_user_id_idx on public.profiles (auth_user_id);
create index if not exists profiles_hq_staff_idx on public.profiles (is_hq_staff);
create index if not exists profiles_hq_role_idx on public.profiles (role_hq);

do $$
declare
  v_target_email text := 'guillaume@kipilote.com';
  v_user_id uuid;
  v_has_user_id_col boolean;
  v_has_email_col boolean;
  v_has_org_col boolean;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = lower(v_target_email)
   limit 1;

  if v_user_id is null then
    raise exception 'Aucun compte auth.users trouve pour %', v_target_email;
  end if;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'user_id'
  )
    into v_has_user_id_col;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'email'
  )
    into v_has_email_col;

  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'organisation_id'
  )
    into v_has_org_col;

  if not v_has_org_col then
    raise exception 'La colonne public.profiles.organisation_id est requise.';
  end if;

  if v_has_user_id_col then
    execute
      'update public.profiles
          set auth_user_id = $1
        where auth_user_id is null
          and user_id = $1'
      using v_user_id;
  end if;

  if v_has_email_col then
    execute
      'update public.profiles
          set auth_user_id = $1
        where auth_user_id is null
          and lower(email) = lower($2)'
      using v_user_id, v_target_email;
  end if;

  update public.profiles
     set is_hq_staff = true,
         role_hq = coalesce(nullif(role_hq, ''), 'Admin HQ'),
         organisation_id = null
   where auth_user_id = v_user_id;

  if not found then
    if v_has_email_col then
      execute
        'insert into public.profiles (auth_user_id, email, is_hq_staff, role_hq, organisation_id)
         values ($1, $2, true, ''Admin HQ'', null)'
        using v_user_id, v_target_email;
    else
      execute
        'insert into public.profiles (auth_user_id, is_hq_staff, role_hq, organisation_id)
         values ($1, true, ''Admin HQ'', null)'
        using v_user_id;
    end if;
  end if;

  update auth.users
     set raw_user_meta_data =
           (coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('is_hq_staff', true, 'role_hq', 'Admin HQ')) - 'organisation_id',
         raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('is_hq_staff', true, 'role_hq', 'Admin HQ')
   where id = v_user_id;
end $$;

commit;
