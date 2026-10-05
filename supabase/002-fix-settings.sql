-- LogiFlow — repair script for a partially applied schema.
--
-- Symptom this fixes: the app logs
--   "new row violates row-level security policy for table company_settings"
-- and Settings cannot be saved, because row-level security is enabled on the
-- tables but the policies below were never created.
--
-- An authenticated browser client cannot create its own RLS policy, so this
-- has to be run once by the table owner.
--
-- Safe to run repeatedly.

-- ---------------------------------------------------------------------------
-- Policies: every signed-in user manages the same books of business
-- ---------------------------------------------------------------------------
do $$ begin
  drop policy if exists "authenticated full access" on public.company_settings;
  create policy "authenticated full access" on public.company_settings
    for all to authenticated using (true) with check (true);
end $$;

do $$ begin
  drop policy if exists "authenticated full access" on public.customers;
  create policy "authenticated full access" on public.customers
    for all to authenticated using (true) with check (true);
end $$;

do $$ begin
  drop policy if exists "authenticated full access" on public.documents;
  create policy "authenticated full access" on public.documents
    for all to authenticated using (true) with check (true);
end $$;

do $$ begin
  drop policy if exists "authenticated full access" on public.line_items;
  create policy "authenticated full access" on public.line_items
    for all to authenticated using (true) with check (true);
end $$;

-- Make sure RLS is on, so the policies above are actually enforced.
alter table public.company_settings enable row level security;
alter table public.customers        enable row level security;
alter table public.documents         enable row level security;
alter table public.line_items        enable row level security;

-- ---------------------------------------------------------------------------
-- Columns added after the first release of the schema
-- ---------------------------------------------------------------------------
alter table public.documents add column if not exists discount  numeric(18,2) not null default 0;
alter table public.documents add column if not exists freight   numeric(18,2) not null default 0;
alter table public.documents add column if not exists insurance numeric(18,2) not null default 0;
alter table public.documents add column if not exists tax       numeric(18,2) not null default 0;

-- `status` is no longer used by the app. Widen the old enum column to text so
-- it matches a fresh install; the values themselves are ignored.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'documents'
       and data_type = 'user-defined'
  ) then
    execute 'alter table public.documents alter column status type text using status::text';
    execute 'alter table public.documents alter column status set default ''draft''';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The single settings row the app expects to exist
-- ---------------------------------------------------------------------------
insert into public.company_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Logo storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update set public = excluded.public;

do $$ begin
  drop policy if exists "authenticated can manage company assets" on storage.objects;
  create policy "authenticated can manage company assets" on storage.objects
    for all to authenticated
    using (bucket_id = 'company-assets')
    with check (bucket_id = 'company-assets');
end $$;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select 'company_settings rows' as check, count(*)::text as result
from public.company_settings
union all
select 'customers rows', count(*)::text from public.customers
union all
select 'documents rows', count(*)::text from public.documents
union all
select 'line_items rows', count(*)::text from public.line_items
union all
select 'logo bucket', coalesce((select 'present' from storage.buckets where id = 'company-assets'), 'MISSING');
