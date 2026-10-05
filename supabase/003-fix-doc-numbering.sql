-- ---------------------------------------------------------------------------
-- 003 — Document numbering fix
--
-- Symptom: creating a second document fails with
--   duplicate key value violates unique constraint "documents_number_type_key"
--
-- Cause: next_doc_number() was never called (no trigger, no app code), so the
-- counters in company_settings never advanced and every create re-proposed the
-- same number. The function also returned the INCREMENTED value while
-- peek_doc_number() returned the current one (an off-by-one), and a counter
-- can drift behind rows that already exist.
--
-- This script:
--   1. rebuilds next_doc_number() to return the current number, then advance
--      the counter — self-healing past any number already in the series;
--   2. rebuilds peek_doc_number() so previews always match what next issues;
--   3. syncs the counters with rows already in documents;
--   4. restricts execute to authenticated + service_role (numbering is
--      server-side only).
-- ---------------------------------------------------------------------------

-- 1. Reserve: hands out the current number, THEN advances the counter.
create or replace function public.next_doc_number(p_doc_type public.doc_type)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_number integer;
  v_floor  integer;
begin
  -- Serialise concurrent callers on the settings row.
  perform 1 from public.company_settings where id = 1 for update;

  if p_doc_type = 'packing_list' then
    select packing_list_prefix, next_packing_list_number
      into v_prefix, v_number
      from public.company_settings
     where id = 1;
  else
    select invoice_prefix, next_invoice_number
      into v_prefix, v_number
      from public.company_settings
     where id = 1;
  end if;

  -- Self-heal: never hand out a number that already exists in this series.
  if p_doc_type = 'packing_list' then
    select coalesce(max(x.suffix::int), 0) + 1
      into v_floor
      from (select substr(d.doc_number, length(v_prefix) + 2) as suffix
              from public.documents d
             where d.doc_type = 'packing_list'
               and d.doc_number like v_prefix || '-%') x
     where x.suffix ~ '^[0-9]{1,9}$';
  else
    select coalesce(max(x.suffix::int), 0) + 1
      into v_floor
      from (select substr(d.doc_number, length(v_prefix) + 2) as suffix
              from public.documents d
             where d.doc_type in ('invoice', 'both')
               and d.doc_number like v_prefix || '-%') x
     where x.suffix ~ '^[0-9]{1,9}$';
  end if;

  v_number := greatest(v_number, v_floor);

  if p_doc_type = 'packing_list' then
    update public.company_settings
       set next_packing_list_number = v_number + 1
     where id = 1;
  else
    update public.company_settings
       set next_invoice_number = v_number + 1
     where id = 1;
  end if;

  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- 2. Preview: exactly the number next_doc_number() would issue right now.
create or replace function public.peek_doc_number(p_doc_type public.doc_type)
returns text
language sql
stable
set search_path = public
as $$
  with s as (
    select invoice_prefix,
           next_invoice_number,
           packing_list_prefix,
           next_packing_list_number
      from public.company_settings
     where id = 1
  )
  select case p_doc_type
    when 'packing_list' then
      (select s.packing_list_prefix || '-' ||
              lpad(greatest(
                     s.next_packing_list_number,
                     (select coalesce(max(x.suffix::int), 0) + 1
                        from (select substr(d.doc_number, length(s.packing_list_prefix) + 2) as suffix
                                from public.documents d
                               where d.doc_type = 'packing_list'
                                 and d.doc_number like s.packing_list_prefix || '-%') x
                       where x.suffix ~ '^[0-9]{1,9}$')
                   )::text, 4, '0')
         from s)
    else
      (select s.invoice_prefix || '-' ||
              lpad(greatest(
                     s.next_invoice_number,
                     (select coalesce(max(x.suffix::int), 0) + 1
                        from (select substr(d.doc_number, length(s.invoice_prefix) + 2) as suffix
                                from public.documents d
                               where d.doc_type in ('invoice', 'both')
                                 and d.doc_number like s.invoice_prefix || '-%') x
                       where x.suffix ~ '^[0-9]{1,9}$')
                   )::text, 4, '0')
         from s)
  end;
$$;

-- 3. One-time sync: counters must sit past every number already issued.
do $$
declare
  v_inv_prefix text;
  v_pl_prefix  text;
  v_inv_floor  integer;
  v_pl_floor   integer;
begin
  select invoice_prefix, packing_list_prefix
    into v_inv_prefix, v_pl_prefix
    from public.company_settings
   where id = 1;

  if v_inv_prefix is null then
    return;
  end if;

  select coalesce(max(x.suffix::int), 0) + 1
    into v_inv_floor
    from (select substr(d.doc_number, length(v_inv_prefix) + 2) as suffix
            from public.documents d
           where d.doc_type in ('invoice', 'both')
             and d.doc_number like v_inv_prefix || '-%') x
   where x.suffix ~ '^[0-9]{1,9}$';

  select coalesce(max(x.suffix::int), 0) + 1
    into v_pl_floor
    from (select substr(d.doc_number, length(v_pl_prefix) + 2) as suffix
            from public.documents d
           where d.doc_type = 'packing_list'
             and d.doc_number like v_pl_prefix || '-%') x
   where x.suffix ~ '^[0-9]{1,9}$';

  update public.company_settings
     set next_invoice_number      = greatest(next_invoice_number, v_inv_floor),
         next_packing_list_number = greatest(next_packing_list_number, v_pl_floor)
   where id = 1;
end $$;

-- 4. Numbering runs server-side only; anon never bumps counters.
revoke execute on function public.next_doc_number(public.doc_type) from public, anon;
revoke execute on function public.peek_doc_number(public.doc_type) from public, anon;
grant execute on function public.next_doc_number(public.doc_type) to authenticated, service_role;
grant execute on function public.peek_doc_number(public.doc_type) to authenticated, service_role;
