-- 008 — Package type per line item (Pallet / Box / Carton / …)
-- Run in the Supabase SQL Editor after deploying the app code that goes with it.

alter table public.line_items
  add column if not exists package_type text not null default 'CTN';

-- Backfill any rows written before the default existed.
update public.line_items
   set package_type = 'CTN'
 where package_type is null or package_type = '';

select 'line_items.package_type' as column, count(*)::text as count
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'line_items'
   and column_name = 'package_type';
