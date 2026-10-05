-- 004 — Multi-entity + unified documents
-- Run in the Supabase SQL Editor AFTER deploying the app code that goes with it.
--
--   1. entities table (per-entity profile, bank details, logo, number series,
--      default currency) — first entity seeded from company_settings
--   2. documents.entity_id: add, backfill, NOT NULL
--   3. drop documents.doc_type + the doc_type enum (documents are unified)
--   4. one document number per entity: unique (entity_id, doc_number),
--      historical invoice/both collisions renamed
--   5. line_items: part_number + coo
--   6. numbering RPCs re-keyed to (p_entity_id uuid), prefix/counter from
--      the entity row (format: <doc_prefix>-0001)

-- ---------------------------------------------------------------------------
-- 1. entities
-- ---------------------------------------------------------------------------
create table if not exists public.entities (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text        not null,
  logo_path           text,
  address_line1       text,
  address_line2       text,
  city                text,
  state               text,
  postal_code         text,
  country             text,
  phone               text,
  email               text,
  website             text,
  tax_id              text,
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  bank_swift          text,
  doc_prefix          text        not null default 'INV',
  next_number         integer     not null default 1,
  default_currency    text        not null default 'USD',
  is_default          boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Exactly one default entity (partial unique index allows the many false rows).
create unique index if not exists entities_default_key
  on public.entities (is_default) where is_default;

create index if not exists entities_name_idx on public.entities (lower(company_name));

do $$ begin
  drop trigger if exists entities_touch on public.entities;
  create trigger entities_touch before update on public.entities
    for each row execute function public.touch_updated_at();
end $$;

alter table public.entities enable row level security;
do $$ begin
  drop policy if exists "authenticated full access" on public.entities;
  create policy "authenticated full access" on public.entities
    for all to authenticated using (true) with check (true);
end $$;

grant all on public.entities to authenticated, service_role;

-- Seed the first entity from company_settings, carrying over the company
-- identity, bank details and the invoice number series (so numbering keeps
-- advancing past every INV-1001-style document already in the database).
insert into public.entities (
  company_name, logo_path, address_line1, address_line2, city, state, postal_code,
  country, phone, email, website, tax_id,
  bank_name, bank_account_name, bank_account_number, bank_swift,
  doc_prefix, next_number, default_currency, is_default
)
select s.company_name, s.logo_path, s.address_line1, s.address_line2, s.city, s.state,
       s.postal_code, s.country, s.phone, s.email, s.website, s.tax_id,
       s.bank_name, s.bank_account_name, s.bank_account_number, s.bank_swift,
       s.invoice_prefix, s.next_invoice_number, s.default_currency, true
from public.company_settings s
where s.id = 1
  and not exists (select 1 from public.entities);

-- ---------------------------------------------------------------------------
-- 2. documents.entity_id
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists entity_id uuid references public.entities (id);

update public.documents d
   set entity_id = (
     select e.id from public.entities e
      order by e.is_default desc, e.created_at asc
      limit 1
   )
 where d.entity_id is null;

alter table public.documents alter column entity_id set not null;

create index if not exists documents_entity_idx on public.documents (entity_id, issue_date desc);

-- ---------------------------------------------------------------------------
-- 3. drop doc_type — every document can print as CI, PL or both
-- (drop the numbering functions first: they take doc_type as a parameter)
-- ---------------------------------------------------------------------------
drop function if exists public.next_doc_number(public.doc_type);
drop function if exists public.peek_doc_number(public.doc_type);

alter table public.documents drop column if exists doc_type;
drop type if exists public.doc_type;

-- ---------------------------------------------------------------------------
-- 4. one number per entity (old key allowed invoice + both to share a number)
-- ---------------------------------------------------------------------------
with dups as (
  select id,
         row_number() over (
           partition by doc_number order by created_at, id
         ) as rn
    from public.documents
)
update public.documents d
   set doc_number = d.doc_number || '-R' || substr(d.id::text, 1, 8)
  from dups u
 where d.id = u.id
   and u.rn > 1;

create unique index if not exists documents_entity_number_key
  on public.documents (entity_id, doc_number);

-- ---------------------------------------------------------------------------
-- 5. line items: part number + country of origin
-- ---------------------------------------------------------------------------
alter table public.line_items add column if not exists part_number text;
alter table public.line_items add column if not exists coo text;

-- ---------------------------------------------------------------------------
-- 6. numbering — atomic, gap-free, one series per entity.
-- Locks the entity row, hands out the current number, advances the counter and
-- self-heals past any number already in this entity's series, so a stale
-- counter can never produce documents_entity_number_key violations.
-- ---------------------------------------------------------------------------
create or replace function public.next_doc_number(p_entity_id uuid)
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
  -- Serialise concurrent callers on the entity row.
  perform 1 from public.entities where id = p_entity_id for update;

  select doc_prefix, next_number
    into v_prefix, v_number
    from public.entities
   where id = p_entity_id;

  if v_prefix is null then
    return null;
  end if;

  -- Self-heal: never hand out a number that already exists in this series.
  select coalesce(max(x.suffix::int), 0) + 1
    into v_floor
    from (select substr(d.doc_number, length(v_prefix) + 2) as suffix
            from public.documents d
           where d.entity_id = p_entity_id
             and d.doc_number like v_prefix || '-%') x
   where x.suffix ~ '^[0-9]{1,9}$';

  v_number := greatest(v_number, v_floor);

  update public.entities
     set next_number = v_number + 1
   where id = p_entity_id;

  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- Preview the number that would be issued next, without consuming it.
-- Mirrors next_doc_number() exactly, so a suggested number always saves.
create or replace function public.peek_doc_number(p_entity_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select e.doc_prefix || '-' ||
         lpad(
           greatest(
             e.next_number,
             (select coalesce(max(x.suffix::int), 0) + 1
                from (select substr(d.doc_number, length(e.doc_prefix) + 2) as suffix
                        from public.documents d
                       where d.entity_id = e.id
                         and d.doc_number like e.doc_prefix || '-%') x
               where x.suffix ~ '^[0-9]{1,9}$')
           )::text,
           4, '0'
         )
    from public.entities e
   where e.id = p_entity_id;
$$;

-- Numbering runs server-side only; anon never bumps counters.
revoke execute on function public.next_doc_number(uuid) from public, anon;
revoke execute on function public.peek_doc_number(uuid) from public, anon;
grant execute on function public.next_doc_number(uuid) to authenticated, service_role;
grant execute on function public.peek_doc_number(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select 'entities' as object, count(*)::text as count from public.entities
union all
select 'documents without entity', count(*)::text
  from public.documents where entity_id is null
union all
select 'documents (doc_type column)', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'documents' and column_name = 'doc_type'
union all
select 'line_items.part_number', count(*)::text
  from information_schema.columns
 where table_schema = 'public' and table_name = 'line_items' and column_name = 'part_number'
union all
select 'duplicate (entity, number) pairs', count(*)::text
  from (select entity_id, doc_number from public.documents
         group by entity_id, doc_number having count(*) > 1) d;
