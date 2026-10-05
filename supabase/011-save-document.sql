-- 011 — Atomic document save: header upsert + line-item replace in one call.
-- Run in the Supabase SQL Editor after deploying the app code that goes with it.
--
-- Previously the app issued three separate PostgREST calls (header
-- insert/update, line delete, line insert). A failure between the delete and
-- the insert orphaned a header-only document. This function performs all
-- three steps in a single transaction: either the whole save lands or none
-- of it does. Number reservation stays outside (row-locked RPCs), so the
-- app's 23505 retry loop keeps working unchanged.

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

-- Same access contract as the numbering RPCs: never anon, only signed-in app
-- users (the app additionally checks the session before calling).
revoke execute on function public.save_document(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_document(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select 'save_document(uuid,uuid,jsonb,jsonb)' as object, count(*)::text as count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'save_document'
   and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, jsonb, jsonb';
