/**
 * Renders the real PDF templates with mock data and writes them to disk.
 * Run with: npm run verify:pdf   (or: npx tsx scripts/smoke-pdf.mts [outDir])
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderDocumentPdf } from "../src/lib/pdf/documents";
import { emptyLineItem } from "../src/lib/money";
import type {
  Entity,
  LineItem,
  ShippingDocumentWithLines,
} from "../src/lib/types";

const ENTITY_ID = "33333333-3333-4333-8333-333333333333";

const entity: Entity = {
  id: ENTITY_ID,
  company_name: "Acme Exports (Pvt) Ltd.",
  logo_path: null,
  address_line1: "Plot 22, Korangi Industrial Area",
  address_line2: "Sector 4",
  city: "Karachi",
  state: "Sindh",
  postal_code: "74900",
  country: "Pakistan",
  phone: "+92 21 3455 0100",
  email: "sales@acmeexports.com",
  website: "www.acmeexports.com",
  tax_id: "NTN 4477881-6",
  trade_license: "0501234-01",
  bank_name: "Meezan Bank",
  bank_account_name: "Acme Exports (Pvt) Ltd.",
  bank_account_number: "PK00 MEZN 0001 2345 6789 0123",
  bank_swift: "MEZNPKKAXXX",
  doc_prefix: "INV",
  next_number: 1042,
  pi_prefix: "PI",
  pi_next_number: 7,
  default_currency: "USD",
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function line(overrides: Partial<LineItem>): LineItem {
  return { ...emptyLineItem(1), ...overrides };
}

const lineItems: LineItem[] = [
  line({
    id: "l1",
    line_no: 1,
    description:
      "100% Combed Cotton T-Shirt, short sleeve, single jersey, assorted colours",
    // 8-digit unbroken HS token (mirrors production CIPL data): exercises the
    // invoice HS column width — the no-merge probe must fail if it overflows.
    hs_code: "85442900",
    part_number: "TS-4419-COM",
    coo: "Pakistan",
    quantity: 12000,
    unit: "PCS",
    unit_price: 2.45,
    discount_percent: 5,
    discount_amount: 1470,
    tax_percent: 0,
    carton_count: 300,
    package_type: "PALLET",
    carton_length_cm: 60,
    carton_width_cm: 40,
    carton_height_cm: 35,
    net_weight_kg: 2400,
    gross_weight_kg: 2700,
    volume_cbm: 25.2,
  }),
  line({
    id: "l2",
    line_no: 2,
    description: "Men's Cotton Casual Trousers, stretch nonwoven, lined",
    hs_code: "6203.42",
    part_number: "TR-8812-STR",
    coo: "Pakistan",
    quantity: 4000,
    unit: "PCS",
    unit_price: 5.8,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 5,
    carton_count: 120,
    package_type: "BOX",
    carton_length_cm: 55,
    carton_width_cm: 40,
    carton_height_cm: 32,
    net_weight_kg: 1360,
    gross_weight_kg: 1500,
    volume_cbm: 8.448,
  }),
  line({
    id: "l3",
    line_no: 3,
    description:
      "Stainless Steel Kitchen Utensils, 18/10, dishwasher safe, packed in printed carton",
    hs_code: "7323.91",
    part_number: "KS-1810-SS",
    coo: "Pakistan",
    quantity: 1500,
    unit: "SET",
    unit_price: 12.4,
    // Flat amount-only discount: percent left at 0, money still counts.
    discount_percent: 0,
    discount_amount: 100,
    tax_percent: 0,
    carton_count: 45,
    package_type: "CTN",
    carton_length_cm: 50,
    carton_width_cm: 40,
    carton_height_cm: 45,
    net_weight_kg: 1125,
    gross_weight_kg: 1260,
    volume_cbm: 4.05,
  }),
];

const doc: ShippingDocumentWithLines = {
  id: "11111111-1111-4111-8111-111111111111",
  entity_id: ENTITY_ID,
  doc_kind: "commercial",
  doc_number: "INV-1041",
  issue_date: "2026-09-24",
  customer_id: "22222222-2222-4222-8222-222222222222",
  currency: "USD",
  status: "draft",
  incoterm: "FOB",
  incoterm_year: 2020,
  incoterm_place: "Karachi Port",
  port_of_loading: "Port Qasim",
  port_of_destination: "Felixstowe",
  vessel: "MV Ocean Star / Voy 118E",
  po_number: "PO-2026-00418",
  payment_terms: "30% advance, 70% against B/L copy",
  include_bank_details: true,
  // Legacy document-level discount/tax: kept in the DB, ignored by the app
  // (totals sum the lines now) — left as 0 so the fixture matches new data.
  discount: 0,
  freight: 1200,
  insurance: 150,
  tax: 0,
  notes:
    "Goods are of Pakistani origin and are free from radioactive contamination, materials of animal origin and wood packing.",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  customer: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Northwind Trading Ltd.",
    contact_person: "Mr. Daniel Whitfield",
    email: "imports@northwindtrade.co.uk",
    phone: "+44 1300 000 1234",
    address_line1: "Unit 12, Dockside Business Park",
    address_line2: "Cnr Dock Road & Quay Street",
    city: "Felixstowe",
    state: "Suffolk",
    postal_code: "IP11 3TU",
    country: "United Kingdom",
    tax_id: "GB 412 8899 21",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  line_items: lineItems,
};

const outDir = process.argv[2] ?? "tmp-verify";
mkdirSync(outDir, { recursive: true });

async function main() {
  for (const kind of ["invoice", "packing_list", "both"] as const) {
    const buffer = await renderDocumentPdf(doc, entity, kind);
    const path = `${outDir}/${doc.doc_number}-${kind}.pdf`;
    writeFileSync(path, buffer);

    const header = buffer.subarray(0, 5).toString("latin1");
    const valid = header === "%PDF-";
    console.log(
      `${kind.padEnd(13)} -> ${String(buffer.length).padStart(7)} bytes  header=${header}  valid=${valid}`,
    );
    if (!valid) throw new Error(`${kind}: not a PDF`);
  }

  // Bank-details toggle off: the invoice still renders, minus the panel.
  const noBank = await renderDocumentPdf(
    { ...doc, include_bank_details: false },
    entity,
    "invoice",
  );
  const noBankPath = `${outDir}/${doc.doc_number}-invoice-nobank.pdf`;
  writeFileSync(noBankPath, noBank);
  const noBankValid = noBank.subarray(0, 5).toString("latin1") === "%PDF-";
  console.log(
    `invoice-nobank -> ${String(noBank.length).padStart(7)} bytes  header=${noBank.subarray(0, 5).toString("latin1")}  valid=${noBankValid}`,
  );
  if (!noBankValid) throw new Error("invoice-nobank: not a PDF");

  // Proforma: same invoice template, PROFORMA INVOICE title.
  const proformaDoc = {
    ...doc,
    doc_kind: "proforma" as const,
    doc_number: "PI-0007",
  };
  const proforma = await renderDocumentPdf(proformaDoc, entity, "proforma");
  const proformaPath = `${outDir}/PI-0007-proforma.pdf`;
  writeFileSync(proformaPath, proforma);
  const proformaValid = proforma.subarray(0, 5).toString("latin1") === "%PDF-";
  console.log(
    `proforma      -> ${String(proforma.length).padStart(7)} bytes  header=${proforma.subarray(0, 5).toString("latin1")}  valid=${proformaValid}`,
  );
  if (!proformaValid) throw new Error("proforma: not a PDF");

  console.log("\nAll export kinds rendered successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
