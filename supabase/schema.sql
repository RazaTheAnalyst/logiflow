-- LogiFlow — Commercial Invoice & Packing List generator
-- Multi-entity deployment: one or more entities (branches/brands), many customers.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL -> New query).

-- ---------------------------------------------------------------------------
-- Company settings — single row, enforced by the check constraint on id.
-- Global document defaults (payment terms, incoterm); per-entity identity and
-- numbering live on `entities`.
-- ---------------------------------------------------------------------------
create table if not exists public.company_settings (
  id                       smallint primary key default 1 check (id = 1),
  company_name             text        not null default 'Your Company Ltd.',
  logo_path                text,
  address_line1            text,
  address_line2            text,
  city                     text,
  state                    text,
  postal_code              text,
  country                  text,
  phone                    text,
  email                    text,
  website                  text,
  tax_id                   text,
  bank_name                text,
  bank_account_name        text,
  bank_account_number      text,
  bank_swift               text,
  default_currency         text        not null default 'USD',
  invoice_prefix           text        not null default 'INV',
  packing_list_prefix      text        not null default 'PL',
  next_invoice_number      integer     not null default 1001,
  next_packing_list_number integer     not null default 1001,
  default_payment_terms    text        not null default '30% advance, 70% against B/L copy',
  default_incoterm         text        not null default 'FOB',
  default_incoterm_year    integer     not null default 2020,
  default_incoterm_place   text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

insert into public.company_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Entities — one per branch/brand: identity, bank details, logo, number
-- series (<doc_prefix>-0001) and default currency. Exactly one is default.
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
  trade_license       text,
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  bank_swift          text,
  doc_prefix          text        not null default 'INV',
  next_number         integer     not null default 1,
  pi_prefix           text        not null default 'PI',
  pi_next_number      integer     not null default 1,
  default_currency    text        not null default 'USD',
  is_default          boolean     not null default false,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists entities_default_key
  on public.entities (is_default) where is_default;

create index if not exists entities_name_idx on public.entities (lower(company_name));

-- Seed the first entity from company_settings (fresh installs).
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

grant all on public.entities to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  contact_person text,
  email          text,
  phone          text,
  address_line1  text,
  address_line2  text,
  city           text,
  state          text,
  postal_code    text,
  country             text,
  tax_id              text,
  notes               text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers (lower(name));

-- ---------------------------------------------------------------------------
-- Documents — one unified document per shipment; print it as a commercial
-- invoice, a packing list, or both. Numbering is per entity.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id                   uuid primary key default gen_random_uuid(),
  entity_id            uuid             not null references public.entities (id),
  -- Commercial invoices live under /documents, proformas under /proforma,
  -- each with its own per-entity number series.
  doc_kind             text             not null default 'commercial'
    check (doc_kind in ('commercial', 'proforma')),
  doc_number           text             not null,
  issue_date           date             not null default current_date,
  customer_id          uuid             not null references public.customers (id) on delete restrict,
  currency             text             not null default 'USD',
  incoterm             text,
  incoterm_year        integer,
  incoterm_place       text,
  port_of_loading      text,
  port_of_destination  text,
  vessel               text,
  po_number            text,
  payment_terms        text,
  -- Bank panel on the commercial invoice PDF (packing lists never show it).
  include_bank_details boolean      not null default true,
  discount             numeric(18, 2) not null default 0,
  freight              numeric(18, 2) not null default 0,
  insurance            numeric(18, 2) not null default 0,
  tax                  numeric(18, 2) not null default 0,
  notes                text,
  -- `status` drives the draft → sent → paid / cancelled workflow surfaced in
  -- the documents list, filters and dashboard. Proformas turned into
  -- commercial invoices are marked `converted`.
  status               text        not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'cancelled', 'converted')),
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint documents_entity_kind_number_key unique (entity_id, doc_kind, doc_number)
);

create index if not exists documents_customer_idx on public.documents (customer_id);
create index if not exists documents_kind_idx on public.documents (doc_kind, issue_date desc);
create index if not exists documents_issue_date_idx on public.documents (issue_date desc);
create index if not exists documents_entity_idx on public.documents (entity_id, issue_date desc);
create index if not exists documents_status_idx on public.documents (status, issue_date desc);

-- ---------------------------------------------------------------------------
-- Line items — shared by invoice (qty/price) and packing list (cartons/weight)
-- ---------------------------------------------------------------------------
create table if not exists public.line_items (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid    not null references public.documents (id) on delete cascade,
  line_no           integer not null default 1,
  description       text    not null,
  hs_code           text,
  part_number       text,
  coo               text,
  quantity          numeric(14, 3) not null default 1,
  unit              text    not null default 'PCS',
  unit_price        numeric(18, 4) not null default 0,
  -- Per-line pricing adjustments: percent and amount stay synced in the UI;
  -- tax applies to the net after discount.
  discount_percent  numeric(7, 4)  not null default 0,
  discount_amount   numeric(18, 2) not null default 0,
  tax_percent       numeric(7, 4)  not null default 0,
  carton_count      numeric(12, 2) not null default 0,
  package_type      text    not null default 'CTN',
  carton_length_cm  numeric(12, 2),
  carton_width_cm   numeric(12, 2),
  carton_height_cm  numeric(12, 2),
  net_weight_kg     numeric(14, 3) not null default 0,
  gross_weight_kg   numeric(14, 3) not null default 0,
  volume_cbm        numeric(14, 4) not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists line_items_document_idx on public.line_items (document_id, line_no);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  drop trigger if exists customers_touch on public.customers;
  create trigger customers_touch before update on public.customers
    for each row execute function public.touch_updated_at();
end $$;

do $$ begin
  drop trigger if exists documents_touch on public.documents;
  create trigger documents_touch before update on public.documents
    for each row execute function public.touch_updated_at();
end $$;

do $$ begin
  drop trigger if exists company_settings_touch on public.company_settings;
  create trigger company_settings_touch before update on public.company_settings
    for each row execute function public.touch_updated_at();
end $$;

do $$ begin
  drop trigger if exists entities_touch on public.entities;
  create trigger entities_touch before update on public.entities
    for each row execute function public.touch_updated_at();
end $$;

-- ---------------------------------------------------------------------------
-- Document numbering — atomic, gap-free, one series per entity.
-- Locks the entity row, hands out the current number, then advances the
-- counter. Self-heals past any number already in the entity's series, so a
-- stale counter can never produce documents_entity_number_key violations.
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

-- PI numbering — same contract on the pi_* columns, self-healing past
-- proforma numbers only, so the INV and PI series advance independently.
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
-- Atomic document save — header upsert + line-item replace in one call.
-- Either the whole save lands or none of it does; a crash can never leave a
-- header-only document behind. Number reservation stays outside (row-locked
-- RPCs) so the app's 23505 retry loop keeps working unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.save_document(
  p_id uuid,
  p_actor uuid,
  p_header jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_updated integer;
begin
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be a JSON array' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.documents (
      entity_id, doc_kind, doc_number, issue_date, customer_id, currency,
      status, incoterm, incoterm_year, incoterm_place, port_of_loading,
      port_of_destination, vessel, po_number, payment_terms,
      include_bank_details, freight, insurance, notes,
      created_by, updated_by
    )
    select
      (p_header->>'entity_id')::uuid,
      coalesce(nullif(p_header->>'doc_kind', ''), 'commercial'),
      p_header->>'doc_number',
      (p_header->>'issue_date')::date,
      (p_header->>'customer_id')::uuid,
      coalesce(nullif(p_header->>'currency', ''), 'USD'),
      coalesce(nullif(p_header->>'status', ''), 'draft'),
      nullif(p_header->>'incoterm', ''),
      (p_header->>'incoterm_year')::integer,
      nullif(p_header->>'incoterm_place', ''),
      nullif(p_header->>'port_of_loading', ''),
      nullif(p_header->>'port_of_destination', ''),
      nullif(p_header->>'vessel', ''),
      nullif(p_header->>'po_number', ''),
      nullif(p_header->>'payment_terms', ''),
      coalesce((p_header->>'include_bank_details')::boolean, true),
      coalesce((p_header->>'freight')::numeric, 0),
      coalesce((p_header->>'insurance')::numeric, 0),
      nullif(p_header->>'notes', ''),
      p_actor,
      p_actor
    returning id into v_id;
  else
    update public.documents set
      entity_id            = (p_header->>'entity_id')::uuid,
      doc_kind             = coalesce(nullif(p_header->>'doc_kind', ''), 'commercial'),
      doc_number           = p_header->>'doc_number',
      issue_date           = (p_header->>'issue_date')::date,
      customer_id          = (p_header->>'customer_id')::uuid,
      currency             = coalesce(nullif(p_header->>'currency', ''), 'USD'),
      status               = coalesce(nullif(p_header->>'status', ''), 'draft'),
      incoterm             = nullif(p_header->>'incoterm', ''),
      incoterm_year        = (p_header->>'incoterm_year')::integer,
      incoterm_place       = nullif(p_header->>'incoterm_place', ''),
      port_of_loading      = nullif(p_header->>'port_of_loading', ''),
      port_of_destination  = nullif(p_header->>'port_of_destination', ''),
      vessel               = nullif(p_header->>'vessel', ''),
      po_number            = nullif(p_header->>'po_number', ''),
      payment_terms        = nullif(p_header->>'payment_terms', ''),
      include_bank_details = coalesce((p_header->>'include_bank_details')::boolean, true),
      freight              = coalesce((p_header->>'freight')::numeric, 0),
      insurance            = coalesce((p_header->>'insurance')::numeric, 0),
      notes                = nullif(p_header->>'notes', ''),
      updated_by           = p_actor
    where id = p_id;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'document % not found', p_id using errcode = 'no_data_found';
    end if;

    v_id := p_id;
  end if;

  delete from public.line_items where document_id = v_id;

  insert into public.line_items (
    document_id, line_no, description, hs_code, part_number, coo,
    quantity, unit, unit_price, discount_percent, discount_amount,
    tax_percent, carton_count, package_type,
    carton_length_cm, carton_width_cm, carton_height_cm,
    net_weight_kg, gross_weight_kg, volume_cbm
  )
  select
    v_id,
    ordinality::integer,
    item->>'description',
    nullif(item->>'hs_code', ''),
    nullif(item->>'part_number', ''),
    nullif(item->>'coo', ''),
    coalesce((item->>'quantity')::numeric, 0),
    coalesce(nullif(item->>'unit', ''), 'PCS'),
    coalesce((item->>'unit_price')::numeric, 0),
    coalesce((item->>'discount_percent')::numeric, 0),
    coalesce((item->>'discount_amount')::numeric, 0),
    coalesce((item->>'tax_percent')::numeric, 0),
    coalesce((item->>'carton_count')::numeric, 0),
    coalesce(nullif(item->>'package_type', ''), 'CTN'),
    (item->>'carton_length_cm')::numeric,
    (item->>'carton_width_cm')::numeric,
    (item->>'carton_height_cm')::numeric,
    coalesce((item->>'net_weight_kg')::numeric, 0),
    coalesce((item->>'gross_weight_kg')::numeric, 0),
    coalesce((item->>'volume_cbm')::numeric, 0)
  from jsonb_array_elements(p_lines) with ordinality as t(item, ordinality);

  return v_id;
end;
$$;

revoke execute on function public.save_document(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_document(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Single-company app: every signed-in user manages the same books of business.
-- Anonymous users get nothing; the service role is used only for numbering.
-- ---------------------------------------------------------------------------
alter table public.company_settings enable row level security;
alter table public.entities         enable row level security;
alter table public.customers        enable row level security;
alter table public.documents         enable row level security;
alter table public.line_items        enable row level security;

do $$ begin
  drop policy if exists "authenticated full access" on public.company_settings;
  create policy "authenticated full access" on public.company_settings
    for all to authenticated using (true) with check (true);
end $$;

do $$ begin
  drop policy if exists "authenticated full access" on public.entities;
  create policy "authenticated full access" on public.entities
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

-- ---------------------------------------------------------------------------
-- Storage bucket for the company logo
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
