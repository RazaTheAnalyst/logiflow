import { calcCbm, round2 } from "./money";
import type { DocumentInput } from "./schemas/document";

function clean(value: string): string | null {
  return value.length > 0 ? value : null;
}

/**
 * Pure builders for the document save payload. Extracted from the server
 * action so the shaping rules (trimming, rounding, CBM derivation) are unit
 * testable without a database. The `save_document` RPC receives exactly what
 * these return.
 */
export function buildDocumentHeader(values: DocumentInput) {
  return {
    entity_id: values.entity_id,
    doc_kind: values.doc_kind || "commercial",
    doc_number: values.doc_number,
    issue_date: values.issue_date,
    customer_id: values.customer_id,
    currency: values.currency,
    status: values.status || "draft",
    incoterm: clean(values.incoterm),
    incoterm_year: values.incoterm_year || 2020,
    incoterm_place: clean(values.incoterm_place),
    port_of_loading: clean(values.port_of_loading),
    port_of_destination: clean(values.port_of_destination),
    vessel: clean(values.vessel),
    po_number: clean(values.po_number),
    payment_terms: clean(values.payment_terms),
    include_bank_details: values.include_bank_details,
    freight: round2(values.freight),
    insurance: round2(values.insurance),
    notes: clean(values.notes),
  };
}

export function buildLineItems(items: DocumentInput["line_items"]) {
  return items.map((item) => ({
    description: item.description,
    hs_code: clean(item.hs_code),
    part_number: clean(item.part_number),
    coo: clean(item.coo),
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    discount_percent: item.discount_percent,
    discount_amount: round2(item.discount_amount),
    tax_percent: item.tax_percent,
    carton_count: item.carton_count,
    package_type: item.package_type || "CTN",
    carton_length_cm: item.carton_length_cm || null,
    carton_width_cm: item.carton_width_cm || null,
    carton_height_cm: item.carton_height_cm || null,
    net_weight_kg: item.net_weight_kg,
    gross_weight_kg: item.gross_weight_kg,
    // CBM is always derived from the dimensions (L x W x H / 1e6) — never
    // trusted from the client — so stored values stay correct.
    volume_cbm: calcCbm(
      item.carton_length_cm,
      item.carton_width_cm,
      item.carton_height_cm,
    ),
  }));
}
