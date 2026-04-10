-- Multi-tenant admin foundation for Kipilote
-- Run this script in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.organisations
  add column if not exists plan text not null default 'STARTER',
  add column if not exists statut text not null default 'actif',
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists billing_email text,
  add column if not exists owner_name text,
  add column if not exists owner_email text,
  add column if not exists seat_count integer not null default 1,
  add column if not exists trial_ends_at date,
  add column if not exists last_seen_at timestamptz,
  add column if not exists temp_access_code text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organisations_set_updated_at on public.organisations;
create trigger organisations_set_updated_at
before update on public.organisations
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount_ht numeric(12, 2) not null check (amount_ht >= 0),
  tax_rate numeric(5, 2) not null default 20 check (tax_rate >= 0 and tax_rate <= 100),
  amount_ttc numeric(12, 2) generated always as (amount_ht * (1 + tax_rate / 100)) stored,
  status text not null default 'pending',
  external_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_invoices_org_idx on public.billing_invoices (organisation_id);
create index if not exists billing_invoices_status_idx on public.billing_invoices (status);
create index if not exists billing_invoices_due_idx on public.billing_invoices (due_date);

drop trigger if exists billing_invoices_set_updated_at on public.billing_invoices;
create trigger billing_invoices_set_updated_at
before update on public.billing_invoices
for each row
execute function public.set_timestamp_updated_at();
