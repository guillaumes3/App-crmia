-- Stock traceability for Kipilote
-- Run this script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.stock_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  changed_by_profile_id uuid references public.profiles (id) on delete set null,
  old_quantite numeric not null,
  new_quantite numeric not null,
  delta_quantite numeric not null,
  reason text not null default 'Mise a jour sans motif',
  created_at timestamptz not null default now()
);

create index if not exists stock_logs_org_idx on public.stock_logs (organisation_id);
create index if not exists stock_logs_article_idx on public.stock_logs (article_id);
create index if not exists stock_logs_created_at_idx on public.stock_logs (created_at desc);

create or replace function public.log_article_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_reason text;
  v_changed_by_profile_id uuid;
begin
  if new.quantite_actuelle is not distinct from old.quantite_actuelle then
    return new;
  end if;

  v_actor := auth.uid();
  v_reason := nullif(trim(current_setting('app.stock_change_reason', true)), '');

  if v_actor is not null then
    select p.id
    into v_changed_by_profile_id
    from public.profiles as p
    where p.id = v_actor
    limit 1;
  end if;

  insert into public.stock_logs (
    organisation_id,
    article_id,
    changed_by_profile_id,
    old_quantite,
    new_quantite,
    delta_quantite,
    reason
  )
  values (
    new.organisation_id,
    new.id,
    v_changed_by_profile_id,
    old.quantite_actuelle,
    new.quantite_actuelle,
    new.quantite_actuelle - old.quantite_actuelle,
    coalesce(v_reason, 'Mise a jour sans motif')
  );

  return new;
end;
$$;

drop trigger if exists articles_log_stock_update on public.articles;
create trigger articles_log_stock_update
after update of quantite_actuelle on public.articles
for each row
when (old.quantite_actuelle is distinct from new.quantite_actuelle)
execute function public.log_article_stock_change();

alter table public.stock_logs enable row level security;

drop policy if exists "stock_logs_select_same_org" on public.stock_logs;
create policy "stock_logs_select_same_org"
on public.stock_logs
for select
to authenticated
using (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);

drop policy if exists "stock_logs_insert_same_org" on public.stock_logs;
create policy "stock_logs_insert_same_org"
on public.stock_logs
for insert
to authenticated
with check (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);

create or replace function public.update_article_stock_with_reason(
  p_article_id uuid,
  p_new_quantite numeric,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('app.stock_change_reason', coalesce(p_reason, ''), true);

  update public.articles
  set quantite_actuelle = p_new_quantite
  where id = p_article_id
    and organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '');

  if not found then
    raise exception 'Article introuvable pour cette organisation.';
  end if;
end;
$$;

-- Optional: set a reason before updating stock in the same DB transaction.
-- Example:
--   select set_config('app.stock_change_reason', 'Reception fournisseur BC-1024', true);
--   update public.articles set quantite_actuelle = quantite_actuelle + 20 where id = '...';
-- Or call:
--   select public.update_article_stock_with_reason('ARTICLE_UUID', 42, 'Correction inventaire');
