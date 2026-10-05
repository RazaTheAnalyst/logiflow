-- 009 — Trade license number per entity (shown in the PDF footer).
-- Run in the Supabase SQL Editor after deploying the app code that goes with it.

alter table public.entities
  add column if not exists trade_license text;

select 'entities.trade_license' as column, count(*)::text as count
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'entities'
   and column_name = 'trade_license';
