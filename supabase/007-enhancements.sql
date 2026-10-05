-- 007 — Status workflow, Incoterms place/year, audit + indexes
-- Run in Supabase SQL Editor after deploying app code.

-- Status: revive the dormant column with a check constraint.
alter table public.documents add column if not exists status text not null default 'draft';
do $$ begin
  alter table public.documents drop constraint if exists documents_status_check;
  alter table public.documents add constraint documents_status_check
    check (status in ('draft','sent','paid','cancelled'));
exception when others then null;
end $$;

-- Incoterms year/place (columns already exist on fresh schema.sql installs).
alter table public.documents add column if not exists incoterm_year integer;
alter table public.documents add column if not exists incoterm_place text;
update public.documents set incoterm_year = 2020 where incoterm_year is null;

-- Audit columns (populated by app when auth is present; nullable for backfill).
alter table public.documents add column if not exists created_by uuid;
alter table public.documents add column if not exists updated_by uuid;
alter table public.customers add column if not exists created_by uuid;
alter table public.entities add column if not exists created_by uuid;

-- Search / filter indexes.
create index if not exists documents_status_idx on public.documents (status, issue_date desc);
create index if not exists documents_number_trgm_idx on public.documents (doc_number);
create index if not exists documents_po_idx on public.documents (po_number);
create index if not exists customers_country_idx on public.customers (country);

-- Ensure numbering RPCs still exist after earlier migrations (idempotent).
-- (Bodies live in schema.sql / 004; no change needed here.)
select '007 applied' as migration;
