-- CRM clients table for Kipilote
-- Run this script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  source text not null default 'Site' check (source in ('Shopify', 'Amazon', 'Site')),
  status text not null default 'Actif' check (status in ('VIP', 'Actif', 'A relancer', 'Inactif')),
  segment text not null default 'Non defini',
  orders_count integer not null default 0 check (orders_count >= 0),
  average_basket numeric(12, 2) not null default 0 check (average_basket >= 0),
  total_spent numeric(12, 2) not null default 0 check (total_spent >= 0),
  last_order_date date,
  churn_risk numeric(5, 2) not null default 0 check (churn_risk >= 0 and churn_risk <= 100),
  next_actions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email)
);

create index if not exists clients_org_idx on public.clients (organisation_id);
create index if not exists clients_org_status_idx on public.clients (organisation_id, status);
create index if not exists clients_org_source_idx on public.clients (organisation_id, source);

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_timestamp_updated_at();

alter table public.clients enable row level security;

drop policy if exists "clients_select_same_org" on public.clients;
create policy "clients_select_same_org"
on public.clients
for select
to authenticated
using (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);

drop policy if exists "clients_insert_same_org" on public.clients;
create policy "clients_insert_same_org"
on public.clients
for insert
to authenticated
with check (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);

drop policy if exists "clients_update_same_org" on public.clients;
create policy "clients_update_same_org"
on public.clients
for update
to authenticated
using (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
)
with check (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);

drop policy if exists "clients_delete_same_org" on public.clients;
create policy "clients_delete_same_org"
on public.clients
for delete
to authenticated
using (
  organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', '')
);
