export interface Entity {
  id: string;
  company_name: string;
  logo_path: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  trade_license: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_swift: string | null;
  doc_prefix: string;
  next_number: number;
  pi_prefix: string;
  pi_next_number: number;
  default_currency: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  logo_path: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_swift: string | null;
  default_currency: string;
  invoice_prefix: string;
  packing_list_prefix: string;
  next_invoice_number: number;
  next_packing_list_number: number;
  default_payment_terms: string;
  default_incoterm: string;
  default_incoterm_year: number;
  default_incoterm_place: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  document_id: string | null;
  line_no: number;
  description: string;
  hs_code: string | null;
  part_number: string | null;
  coo: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  carton_count: number;
  package_type: string;
  carton_length_cm: number | null;
  carton_width_cm: number | null;
  carton_height_cm: number | null;
  net_weight_kg: number;
  gross_weight_kg: number;
  volume_cbm: number;
  created_at?: string;
}

export type DocKind = "commercial" | "proforma";

export interface ShippingDocument {
  id: string;
  entity_id: string;
  doc_kind: DocKind;
  doc_number: string;
  issue_date: string;
  customer_id: string;
  currency: string;
  incoterm: string | null;
  incoterm_year: number | null;
  incoterm_place: string | null;
  port_of_loading: string | null;
  port_of_destination: string | null;
  vessel: string | null;
  po_number: string | null;
  payment_terms: string | null;
  include_bank_details: boolean;
  discount: number;
  freight: number;
  insurance: number;
  tax: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingDocumentWithLines extends ShippingDocument {
  customer: Customer | null;
  line_items: LineItem[];
}

export interface DocumentTotals {
  lineCount: number;
  quantity: number;
  cartonCount: number;
  netWeightKg: number;
  grossWeightKg: number;
  volumeCbm: number;
  subtotal: number;
  discount: number;
  freight: number;
  insurance: number;
  tax: number;
  grandTotal: number;
}

export interface DocumentFormValues {
  entity_id: string;
  doc_kind: DocKind;
  doc_number: string;
  issue_date: string;
  customer_id: string;
  currency: string;
  incoterm: string;
  incoterm_year: number;
  incoterm_place: string;
  port_of_loading: string;
  port_of_destination: string;
  vessel: string;
  po_number: string;
  payment_terms: string;
  notes: string;
  include_bank_details: boolean;
  freight: number;
  insurance: number;
  line_items: LineItem[];
}

export interface CustomerFormValues {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  tax_id: string;
  notes: string;
}

export interface CompanySettingsFormValues {
  default_payment_terms: string;
  default_incoterm: string;
  default_incoterm_year: string;
  default_incoterm_place: string;
}

export interface EntityFormValues {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
  trade_license: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_swift: string;
  doc_prefix: string;
  next_number: number;
  default_currency: string;
  is_default: "1" | "0";
}
