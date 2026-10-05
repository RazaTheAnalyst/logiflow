-- 012 — SUPERSEDED by 013-drop-status.sql. Do not run.
-- This file tried to widen the legacy doc_status enum to text, but the app no
-- longer uses status at all — 013 drops the column instead. Kept for history.
--
-- Prerequisites (in order): 008, 009, 010, 011, then this file. All are
-- re-runnable.
--
-- Why not a simple ALTER ... USING: that rewrite fails on this database
-- with `operator does not exist: text = doc_status`, i.e. some dependent
-- object trips the in-place rewrite. So this migration widens via
-- add-column → backfill → drop → rename, which never rewrites in place.
-- Plain (non-CASCADE) drops are used on purpose: if an unknown object
-- depends on the old column, the statement fails LOUDLY naming it — paste
-- that error back instead of guessing.
--
-- Safe to run repeatedly; a no-op once status is text.

-- ---------------------------------------------------------------------------
-- 0. Diagnostics — always runs. If anything below fails, send this output
--    plus the error message back.
-- ---------------------------------------------------------------------------
select 'status_column_type' as check,
  coalesce(
    (select udt_name from information_schema.columns
      where table_schema = 'public' and table_name = 'documents'
        and column_name = 'status'),
    'MISSING'
  ) as result
union all
select 'status_values:' || coalesce(status, '(null)'), count(*)::text
  from public.documents group by status
union all
select 'constraint: ' || conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.documents'::regclass
union all
select 'policy: ' || policyname,
  coalesce(qual::text, '') || ' / ' || coalesce(with_check::text, '')
  from pg_policies where schemaname = 'public' and tablename = 'documents'
union all
select 'index: ' || indexrelid::regclass::text,
  pg_get_indexdef(indexrelid)
  from pg_index where indrelid = 'public.documents'::regclass
union all
select 'trigger: ' || tgname, 'present'
  from pg_trigger
 where tgrelid = 'public.documents'::regclass and not tgisinternal;

-- ---------------------------------------------------------------------------
-- 1. Drop the objects we own and will recreate (plain drops — unknown
--    dependents fail loudly here instead of mid-migration).
-- ---------------------------------------------------------------------------
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents drop constraint if exists documents_kind_check;
drop index if exists public.documents_status_idx;

-- ---------------------------------------------------------------------------
-- 2. Widen enum → text, preserving values. Skipped entirely when status is
--    already text (normal re-run path).
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'documents'
       and column_name = 'status'
       and udt_name = 'doc_status'
  ) then
    alter table public.documents
      add column if not exists status_new text;
    update public.documents
       set status_new = status::text
     where status_new is distinct from status::text;
    alter table public.documents drop column status;
    alter table public.documents rename column status_new to status;
  elsif exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'documents'
       and column_name = 'status_new'
  ) then
    -- A previous partial run dropped the old column but never renamed:
    -- finish the job.
    alter table public.documents rename column status_new to status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Defaults, nullability, checks, index — matching schema.sql for fresh
--    installs. The kind check needs 010's doc_kind column; if it is missing
--    the report below shows it and you should run 010 first.
-- ---------------------------------------------------------------------------
update public.documents set status = 'draft' where status is null;
alter table public.documents alter column status set default 'draft';
alter table public.documents alter column status set not null;

do $$ begin
  alter table public.documents add constraint documents_status_check
    check (status in ('draft', 'sent', 'paid', 'cancelled', 'converted'));
exception when others then null;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'documents'
       and column_name = 'doc_kind'
  ) then
    alter table public.documents add constraint documents_kind_check
      check (doc_kind in ('commercial', 'proforma'));
  else
    raise notice 'doc_kind column missing — run 010 first, then re-run this file';
  end if;
end $$;

create index if not exists documents_status_idx
  on public.documents (status, issue_date desc);

-- ---------------------------------------------------------------------------
-- 4. Report — status_type must read `text`, both checks `present`,
--    null_statuses `0`. Anything else: send this output back.
-- ---------------------------------------------------------------------------
select 'status_type' as check,
  coalesce(
    (select udt_name from information_schema.columns
      where table_schema = 'public' and table_name = 'documents'
        and column_name = 'status'),
    'MISSING'
  ) as result
union all
select 'null_statuses', count(*)::text
  from public.documents where status is null
union all
select 'documents_status_check',
  count(*)::text from pg_constraint where conname = 'documents_status_check'
union all
select 'documents_kind_check',
  count(*)::text from pg_constraint where conname = 'documents_kind_check'
union all
select 'documents_status_idx',
  count(*)::text from pg_class where relname = 'documents_status_idx'
union all
select 'doc_kind_present',
  count(*)::text from information_schema.columns
 where table_schema = 'public' and table_name = 'documents'
   and column_name = 'doc_kind';
