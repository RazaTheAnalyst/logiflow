-- 010 — Proforma invoices: kind flag, separate PI number series, converted status
-- Run in the Supabase SQL Editor after deploying the app code that goes with it.

-- Kind flag: every existing document is commercial.
alter table public.documents
  add column if not exists doc_kind text not null default 'commercial';

do $$ begin
  alter table public.documents drop constraint if exists documents_kind_check;
  alter table public.documents add constraint documents_kind_check
    check (doc_kind in ('commercial', 'proforma'));
exception when others then null;
end $$;

-- Converted status for proformas turned into commercial invoices.
do $$ begin
  alter table public.documents drop constraint if exists documents_status_check;
  alter table public.documents add constraint documents_status_check
    check (status in ('draft', 'sent', 'paid', 'cancelled', 'converted'));
exception when others then null;
end $$;

-- Separate PI series per entity.
alter table public.entities
  add column if not exists pi_prefix text not null default 'PI';
alter table public.entities
  add column if not exists pi_next_number integer not null default 1;

-- Uniqueness now spans the kind (a PI-0001 and an INV-0001 coexist, but two
-- PI-0001s under one entity cannot).
alter table public.documents drop constraint if exists documents_entity_number_key;
drop index if exists public.documents_entity_number_key;
create unique index if not exists documents_entity_kind_number_key
  on public.documents (entity_id, doc_kind, doc_number);

create index if not exists documents_kind_idx
  on public.documents (doc_kind, issue_date desc);

-- ---------------------------------------------------------------------------
-- PI numbering — mirrors next_doc_number()/peek_doc_number() exactly, but on
-- the pi_* columns and self-healing only past proforma numbers, so the two
-- series advance independently and can never collide.
-- ---------------------------------------------------------------------------
create or replace function public.next_pi_number(p_entity_id uuid)
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
  perform 1 from public.entities where id = p_entity_id for update;

  select pi_prefix, pi_next_number
    into v_prefix, v_number
    from public.entities
   where id = p_entity_id;

  if v_prefix is null then
    return null;
  end if;

  select coalesce(max(x.suffix::int), 0) + 1
    into v_floor
    from (select substr(d.doc_number, length(v_prefix) + 2) as suffix
            from public.documents d
           where d.entity_id = p_entity_id
             and d.doc_kind = 'proforma'
             and d.doc_number like v_prefix || '-%') x
   where x.suffix ~ '^[0-9]{1,9}$';

  v_number := greatest(v_number, v_floor);

  update public.entities
     set pi_next_number = v_number + 1
   where id = p_entity_id;

  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

create or replace function public.peek_pi_number(p_entity_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select e.pi_prefix || '-' ||
         lpad(
           greatest(
             e.pi_next_number,
             (select coalesce(max(x.suffix::int), 0) + 1
                from (select substr(d.doc_number, length(e.pi_prefix) + 2) as suffix
                        from public.documents d
                       where d.entity_id = e.id
                         and d.doc_kind = 'proforma'
                         and d.doc_number like e.pi_prefix || '-%') x
               where x.suffix ~ '^[0-9]{1,9}$')
           )::text,
           4, '0'
         )
    from public.entities e
   where e.id = p_entity_id;
$$;

revoke execute on function public.next_pi_number(uuid) from public, anon;
revoke execute on function public.peek_pi_number(uuid) from public, anon;
grant execute on function public.next_pi_number(uuid) to authenticated, service_role;
grant execute on function public.peek_pi_number(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select 'documents.doc_kind' as object, count(*)::text as count
  from information_schema.columns
 where table_schema = 'public' and table_name = 'documents' and column_name = 'doc_kind'
union all
select 'entities.pi_prefix', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'entities' and column_name = 'pi_prefix'
union all
select 'duplicate (entity, kind, number) pairs', count(*)::text
  from (select entity_id, doc_kind, doc_number from public.documents
         group by entity_id, doc_kind, doc_number having count(*) > 1) d;
