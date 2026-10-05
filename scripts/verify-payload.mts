import { validateDocumentPayload } from "../src/lib/schemas/document";
import {
  buildDocumentHeader,
  buildLineItems,
} from "../src/lib/document-payload";
import { emptyLineItem } from "../src/lib/money";

/**
 * Unit checks for the save-payload builders (scripts/verify-payload.mts).
 * These pure functions shape exactly what the transactional `save_document`
 * RPC receives, so their rules — trimming, rounding, CBM derivation — are
 * pinned here without needing a database.
 */

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "33333333-3333-4333-8333-333333333333";

function validatedInput(overrides: Record<string, unknown> = {}) {
  const result = validateDocumentPayload({
    entity_id: ENTITY_ID,
    doc_kind: "commercial",
    doc_number: "INV-1001",
    issue_date: "2026-09-28",
    customer_id: CUSTOMER_ID,
    currency: "USD",
    status: "draft",
    incoterm: "FOB",
    incoterm_year: 2020,
    incoterm_place: "",
    port_of_loading: "",
    port_of_destination: "",
    vessel: "",
    po_number: "",
    payment_terms: "30% advance",
    notes: "",
    freight: "0",
    insurance: "0",
    line_items: JSON.stringify([
      {
        ...emptyLineItem(1),
        description: "Cotton T-shirts",
        quantity: "1000",
        unit_price: "2.45",
        carton_length_cm: "60",
        carton_width_cm: "40",
        carton_height_cm: "35",
      },
    ]),
    ...overrides,
  });
  if (!result.ok || !result.data) {
    console.log(`SETUP FAILED: ${JSON.stringify(result.ok ? {} : result.fieldErrors)}`);
    process.exit(1);
  }
  return result.data;
}

console.log("--- document header shaping ---");
{
  const header = buildDocumentHeader(validatedInput());
  check("entity passes through", header.entity_id, ENTITY_ID);
  check("doc number passes through", header.doc_number, "INV-1001");
  check("blank incoterm place becomes null", header.incoterm_place, null);
  check("payment terms kept", header.payment_terms, "30% advance");
  check("blank notes become null", header.notes, null);
  check("bank flag passes through", header.include_bank_details, true);

  const rounded = buildDocumentHeader(
    validatedInput({ freight: "1.005", insurance: "2.675" }),
  );
  check("freight rounded to 2dp", rounded.freight, 1.01);
  check("insurance rounded to 2dp", rounded.insurance, 2.68);

  const defaulted = buildDocumentHeader(
    validatedInput({ doc_kind: "", status: "" }),
  );
  check("blank kind defaults to commercial", defaulted.doc_kind, "commercial");
  check("blank status defaults to draft", defaulted.status, "draft");
}

console.log("\n--- line item shaping ---");
{
  const [line] = buildLineItems(validatedInput().line_items);
  check("description kept", line!.description, "Cotton T-shirts");
  check("null hs_code becomes null", line!.hs_code, null);
  check("package defaults to CTN", line!.package_type, "CTN");
  check(
    "CBM derived from dims, never trusted",
    line!.volume_cbm,
    0.084,
  );
  check("no document_id key (RPC assigns it)", "document_id" in line!, false);
  check("no line_no key (RPC assigns it)", "line_no" in line!, false);

  const [tampered] = buildLineItems(
    validatedInput({
      line_items: JSON.stringify([
        {
          ...emptyLineItem(1),
          description: "X",
          carton_length_cm: "60",
          carton_width_cm: "40",
          carton_height_cm: "35",
          volume_cbm: "999",
        },
      ]),
    }).line_items,
  );
  check("client CBM ignored in favour of derived", tampered!.volume_cbm, 0.084);

  const [nodims] = buildLineItems(
    validatedInput({
      line_items: JSON.stringify([
        { ...emptyLineItem(1), description: "Y", volume_cbm: "5" },
      ]),
    }).line_items,
  );
  check("missing dims yield zero CBM", nodims!.volume_cbm, 0);
  check("missing dims stay null", nodims!.carton_length_cm, null);

  const [rounded] = buildLineItems(
    validatedInput({
      line_items: JSON.stringify([
        {
          ...emptyLineItem(1),
          description: "Z",
          discount_amount: "10.115",
        },
      ]),
    }).line_items,
  );
  check("discount amount rounded to 2dp", rounded!.discount_amount, 10.12);
}

console.log(
  failed === 0 ? "\nAll payload checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed > 0 ? 1 : 0);
