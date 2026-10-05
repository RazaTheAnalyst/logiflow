-- 013 — Drop documents.status entirely.
-- Run in the Supabase SQL Editor. Prerequisites: none beyond 008–011 for the
-- app code that goes with this change (run those first if pending).
--
-- Background: very old installs carry status as a doc_status enum; every
-- attempt to widen or constrain it in place trips over dependent objects
-- (`operator does not exist: text = doc_status`, `invalid input value for
-- enum`, …). The app no longer reads or writes status at all, so instead of
-- converting the column we remove it. Plain (non-CASCADE) drops are used on
-- purpose: if an unknown object depends on the column, the statement fails
-- LOUDLY naming it — paste that error back instead of guessing.
--
-- Safe to run repeatedly; a no-op once the column is gone.

-- 1. Drop objects we own that reference the column.
drop index if exists public.documents_status_idx;
alter table public.documents drop constraint if exists documents_status_check;

-- 2. Drop the column itself.
alter table public.documents drop column if exists status;

-- 3. Re-issue save_document without the status column. The 011 version
-- writes status on insert/update and breaks once the column is gone, so the
-- fixed definition lives here (013 runs last). Fresh installs get the same
-- body from schema.sql.

-- ---------------------------------------------------------------------------
-- 4. Re-issue save_document without the status column (same body as 011
--    minus status on insert/update). Required: the 011 version names the
--    dropped column and would fail every save.
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
      incoterm, incoterm_year, incoterm_place, port_of_loading,
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
-- 5. Report — status_column must read MISSING, everything else 0.
-- ---------------------------------------------------------------------------
select 'status_column' as check,
  coalesce(
    (select udt_name from information_schema.columns
      where table_schema = 'public' and table_name = 'documents'
        and column_name = 'status'),
    'MISSING'
  ) as result
union all
select 'documents_status_check',
  count(*)::text from pg_constraint where conname = 'documents_status_check'
union all
select 'documents_status_idx',
  count(*)::text from pg_class where relname = 'documents_status_idx';
