-- Module fournisseurs + achats pour Kipilote
-- A executer dans l'editeur SQL Supabase

create extension if not exists pgcrypto;

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  nom text not null,
  categorie_produits text,
  contact_nom text,
  contact_email text,
  telephone text,
  franco_port_ht numeric(12, 2) not null default 0 check (franco_port_ht >= 0),
  delai_livraison_jours integer not null default 0 check (delai_livraison_jours >= 0),
  mode_reappro_auto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, nom)
);

create index if not exists fournisseurs_org_idx on public.fournisseurs (organisation_id);
create index if not exists fournisseurs_org_mode_auto_idx on public.fournisseurs (organisation_id, mode_reappro_auto);

drop trigger if exists fournisseurs_set_updated_at on public.fournisseurs;
create trigger fournisseurs_set_updated_at
before update on public.fournisseurs
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.fournisseur_produits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs (id) on delete cascade,
  article_id uuid not null,
  sku_fournisseur text,
  prix_achat_ht numeric(12, 2) not null default 0 check (prix_achat_ht >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, fournisseur_id, article_id)
);

create index if not exists fournisseur_produits_org_fournisseur_idx on public.fournisseur_produits (organisation_id, fournisseur_id);
create index if not exists fournisseur_produits_org_article_idx on public.fournisseur_produits (organisation_id, article_id);

drop trigger if exists fournisseur_produits_set_updated_at on public.fournisseur_produits;
create trigger fournisseur_produits_set_updated_at
before update on public.fournisseur_produits
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.commandes_achats (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  fournisseur_id uuid not null references public.fournisseurs (id) on delete restrict,
  reference text not null,
  statut text not null default 'Brouillon' check (statut in ('Brouillon', 'Envoye', 'Recu')),
  source text not null default 'manuel',
  total_ht numeric(12, 2) not null default 0 check (total_ht >= 0),
  lignes jsonb not null default '[]'::jsonb,
  date_commande timestamptz,
  date_reception_prevue date,
  date_receptionnee date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commandes_achats_org_fournisseur_idx on public.commandes_achats (organisation_id, fournisseur_id);
create index if not exists commandes_achats_org_statut_idx on public.commandes_achats (organisation_id, statut);
create index if not exists commandes_achats_org_date_idx on public.commandes_achats (organisation_id, created_at desc);

drop trigger if exists commandes_achats_set_updated_at on public.commandes_achats;
create trigger commandes_achats_set_updated_at
before update on public.commandes_achats
for each row
execute function public.set_timestamp_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'articles'
  ) then
    execute $sql$
      alter table public.articles
        add column if not exists fournisseur_id uuid references public.fournisseurs (id) on delete set null,
        add column if not exists seuil_alerte integer not null default 0
    $sql$;
    execute 'create index if not exists articles_org_fournisseur_idx on public.articles (organisation_id, fournisseur_id)';
    execute 'create index if not exists articles_org_seuil_idx on public.articles (organisation_id, seuil_alerte)';
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'produits'
  ) then
    execute $sql$
      alter table public.produits
        add column if not exists fournisseur_id uuid references public.fournisseurs (id) on delete set null,
        add column if not exists seuil_alerte integer not null default 0
    $sql$;
    execute 'create index if not exists produits_org_fournisseur_idx on public.produits (organisation_id, fournisseur_id)';
    execute 'create index if not exists produits_org_seuil_idx on public.produits (organisation_id, seuil_alerte)';
  else
    raise notice 'Aucune table articles ou produits detectee. Le lien stock-fournisseur devra etre ajuste.';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'articles'
  ) then
    execute $view$
      create or replace view public.v_fournisseur_articles as
      select
        fp.id,
        fp.organisation_id,
        fp.fournisseur_id,
        fp.article_id,
        a.nom as article_nom,
        coalesce(a.stock, 0)::numeric as stock_actuel,
        coalesce(a.seuil_alerte, 0) as seuil_alerte,
        fp.sku_fournisseur,
        fp.prix_achat_ht,
        f.mode_reappro_auto
      from public.fournisseur_produits fp
      join public.fournisseurs f
        on f.id = fp.fournisseur_id
       and f.organisation_id = fp.organisation_id
      left join public.articles a
        on a.id = fp.article_id
       and a.organisation_id = fp.organisation_id
    $view$;
  elsif exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'produits'
  ) then
    execute $view$
      create or replace view public.v_fournisseur_articles as
      select
        fp.id,
        fp.organisation_id,
        fp.fournisseur_id,
        fp.article_id,
        a.nom as article_nom,
        coalesce(a.stock, 0)::numeric as stock_actuel,
        coalesce(a.seuil_alerte, 0) as seuil_alerte,
        fp.sku_fournisseur,
        fp.prix_achat_ht,
        f.mode_reappro_auto
      from public.fournisseur_produits fp
      join public.fournisseurs f
        on f.id = fp.fournisseur_id
       and f.organisation_id = fp.organisation_id
      left join public.produits a
        on a.id = fp.article_id
       and a.organisation_id = fp.organisation_id
    $view$;
  else
    execute $view$
      create or replace view public.v_fournisseur_articles as
      select
        fp.id,
        fp.organisation_id,
        fp.fournisseur_id,
        fp.article_id,
        null::text as article_nom,
        0::numeric as stock_actuel,
        0::integer as seuil_alerte,
        fp.sku_fournisseur,
        fp.prix_achat_ht,
        f.mode_reappro_auto
      from public.fournisseur_produits fp
      join public.fournisseurs f
        on f.id = fp.fournisseur_id
       and f.organisation_id = fp.organisation_id
    $view$;
  end if;
end;
$$;

alter table public.fournisseurs enable row level security;
alter table public.fournisseur_produits enable row level security;
alter table public.commandes_achats enable row level security;

drop policy if exists "fournisseurs_select_same_org" on public.fournisseurs;
create policy "fournisseurs_select_same_org"
on public.fournisseurs
for select
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseurs_insert_same_org" on public.fournisseurs;
create policy "fournisseurs_insert_same_org"
on public.fournisseurs
for insert
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseurs_update_same_org" on public.fournisseurs;
create policy "fournisseurs_update_same_org"
on public.fournisseurs
for update
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''))
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseurs_delete_same_org" on public.fournisseurs;
create policy "fournisseurs_delete_same_org"
on public.fournisseurs
for delete
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseur_produits_select_same_org" on public.fournisseur_produits;
create policy "fournisseur_produits_select_same_org"
on public.fournisseur_produits
for select
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseur_produits_insert_same_org" on public.fournisseur_produits;
create policy "fournisseur_produits_insert_same_org"
on public.fournisseur_produits
for insert
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseur_produits_update_same_org" on public.fournisseur_produits;
create policy "fournisseur_produits_update_same_org"
on public.fournisseur_produits
for update
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''))
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "fournisseur_produits_delete_same_org" on public.fournisseur_produits;
create policy "fournisseur_produits_delete_same_org"
on public.fournisseur_produits
for delete
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "commandes_achats_select_same_org" on public.commandes_achats;
create policy "commandes_achats_select_same_org"
on public.commandes_achats
for select
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "commandes_achats_insert_same_org" on public.commandes_achats;
create policy "commandes_achats_insert_same_org"
on public.commandes_achats
for insert
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "commandes_achats_update_same_org" on public.commandes_achats;
create policy "commandes_achats_update_same_org"
on public.commandes_achats
for update
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''))
with check (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

drop policy if exists "commandes_achats_delete_same_org" on public.commandes_achats;
create policy "commandes_achats_delete_same_org"
on public.commandes_achats
for delete
using (organisation_id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'organisation_id', ''));

grant select on public.v_fournisseur_articles to authenticated;
