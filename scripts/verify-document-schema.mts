import { validateDocumentPayload } from "../src/lib/schemas/document";
import { emptyLineItem } from "../src/lib/money";

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

/** A brand-new document exactly as the builder posts it: strings + nulls. */
function newDocumentPayload() {
  return {
    entity_id: ENTITY_ID,
    doc_number: "INV-1001",
    issue_date: "2026-09-28",
    customer_id: CUSTOMER_ID,
    currency: "USD",
    incoterm: "FOB",
    port_of_loading: "",
    port_of_destination: "",
    vessel: "",
    po_number: "",
    payment_terms: "",
    notes: "",
    status: "draft",
    freight: "0",
    insurance: "0",
    // The regression: a fresh line item carries null for every optional field,
    // and the form serialises it straight through as JSON null.
    line_items: JSON.stringify([
      {
        ...emptyLineItem(1),
        description: "Cotton T-shirts",
        quantity: "1000",
        unit_price: "2.45",
      },
    ]),
  };
}

console.log("--- document kind defaults to commercial, proforma passes ---");
{
  const commercial = validateDocumentPayload(newDocumentPayload());
  check("doc_kind defaults to commercial", commercial.data?.doc_kind, "commercial");
  const proforma = validateDocumentPayload({
    ...newDocumentPayload(),
    doc_kind: "proforma",
    doc_number: "PI-0001",
  });
  check("proforma kind accepted", proforma.ok, true);
  check("proforma kind kept", proforma.data?.doc_kind, "proforma");
  const bogus = validateDocumentPayload({
    ...newDocumentPayload(),
    doc_kind: "bogus",
  });
  check("bogus kind falls back to commercial", bogus.data?.doc_kind, "commercial");
}

console.log("--- new document with a blank HS code (the reported bug) ---");
{
  const result = validateDocumentPayload(newDocumentPayload());
  check("accepts a fresh line item with null hs_code", result.ok, true);
  if (!result.ok) {
    console.log(`        fieldErrors: ${JSON.stringify(result.fieldErrors)}`);
  }
}

console.log("\n--- a fully blank/empty new document ---");
{
  const result = validateDocumentPayload(newDocumentPayload());
  check("still rejects an empty line description", result.ok, true);
}

console.log("\n--- genuinely invalid input is still rejected, with a useful key ---");
{
  const noDescription = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([{ ...emptyLineItem(1), description: "" }]),
  });
  check("blank description rejected", noDescription.ok, false);
  check(
    "error keyed to line_items.0.description",
    noDescription.fieldErrors?.["line_items.0.description"],
    "Description is required",
  );

  const noCustomer = validateDocumentPayload({ ...newDocumentPayload(), customer_id: "" });
  check("missing customer rejected", noCustomer.ok, false);
  check("error keyed to customer_id", noCustomer.fieldErrors?.customer_id, "Select a customer");

  const noEntity = validateDocumentPayload({ ...newDocumentPayload(), entity_id: "" });
  check("missing entity rejected", noEntity.ok, false);
  check("error keyed to entity_id", noEntity.fieldErrors?.entity_id, "Select an entity");

  const badEntity = validateDocumentPayload({
    ...newDocumentPayload(),
    entity_id: "not-a-uuid",
  });
  check("non-uuid entity rejected", badEntity.ok, false);
  check(
    "error keyed to entity_id",
    badEntity.fieldErrors?.entity_id,
    "Select an entity",
  );

  const noItems = validateDocumentPayload({ ...newDocumentPayload(), line_items: "[]" });
  check("empty line_items rejected", noItems.ok, false);
  check("error keyed to line_items", noItems.fieldErrors?.line_items, "Add at least one line item");

  const negative = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      { ...emptyLineItem(1), description: "X", quantity: "-5" },
    ]),
  });
  check("negative quantity rejected", negative.ok, false);
}

console.log("\n--- numeric coercion ---");
{
  const result = validateDocumentPayload(newDocumentPayload());
  const line = result.data?.line_items[0];
  check("string number coerced", line?.quantity, 1000);
  check("string price coerced", line?.unit_price, 2.45);
  check("null dimension becomes 0", line?.carton_length_cm, 0);
  check("blank text becomes empty string", line?.hs_code, "");
  check("null part_number becomes empty string", line?.part_number, "");
  check("null coo becomes empty string", line?.coo, "");
  check("fresh line defaults discount percent to 0", line?.discount_percent, 0);
  check("fresh line defaults discount amount to 0", line?.discount_amount, 0);
  check("fresh line defaults tax percent to 0", line?.tax_percent, 0);
  check("fresh line defaults package type to CTN", line?.package_type, "CTN");
  check("empty charge coerced to 0", result.data?.freight, 0);
  check("entity_id carried through", result.data?.entity_id, ENTITY_ID);
  check(
    "doc_type is gone from the saved shape",
    !("doc_type" in (result.data as Record<string, unknown>)),
    true,
  );
  check(
    "incoterm year/place carried in the payload",
    "incoterm_year" in (result.data as Record<string, unknown>) &&
      "incoterm_place" in (result.data as Record<string, unknown>),
    true,
  );
  check("incoterm year defaults to 2020", result.data?.incoterm_year, 2020);
}

console.log("\n--- per-line discount and tax ---");
{
  const ok = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      {
        ...emptyLineItem(1),
        description: "X",
        quantity: "10",
        unit_price: "100",
        discount_percent: "5.5",
        discount_amount: "55",
        tax_percent: "15",
      },
    ]),
  });
  check("valid percentages accepted", ok.ok, true);
  if (!ok.ok) {
    console.log(`        fieldErrors: ${JSON.stringify(ok.fieldErrors)}`);
  }
  check("discount percent coerced", ok.data?.line_items[0].discount_percent, 5.5);
  check("discount amount coerced", ok.data?.line_items[0].discount_amount, 55);
  check("tax percent coerced", ok.data?.line_items[0].tax_percent, 15);

  const packed = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      { ...emptyLineItem(1), description: "X", package_type: "pallet" },
    ]),
  });
  check("package type uppercased", packed.data?.line_items[0].package_type, "PALLET");

  const over = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      { ...emptyLineItem(1), description: "X", discount_percent: "120" },
    ]),
  });
  check("discount percent over 100 rejected", over.ok, false);
  check(
    "error keyed to line_items.0.discount_percent",
    over.fieldErrors?.["line_items.0.discount_percent"] !== undefined,
    true,
  );

  const negTax = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      { ...emptyLineItem(1), description: "X", tax_percent: "-1" },
    ]),
  });
  check("negative tax percent rejected", negTax.ok, false);

  const negAmount = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: JSON.stringify([
      { ...emptyLineItem(1), description: "X", discount_amount: "-10" },
    ]),
  });
  check("negative discount amount rejected", negAmount.ok, false);

  // Document-level discount/tax are legacy: the form no longer posts them.
  // Status + incoterm year/place ARE part of the payload now.
  const legacy = validateDocumentPayload({
    ...newDocumentPayload(),
    discount: "99",
    tax: "88",
    incoterm_year: "2010",
    incoterm_place: "Dubai",
    status: "sent",
  });
  const saved = (legacy.data ?? {}) as Record<string, unknown>;
  check("legacy document discount stripped", "discount" in saved, false);
  check("legacy document tax stripped", "tax" in saved, false);
  check("incoterm year kept", saved.incoterm_year, 2010);
  check("incoterm place kept", saved.incoterm_place, "Dubai");
  check("status kept", saved.status, "sent");
}

console.log("\n--- bank-details toggle (hidden input posts 1/0) ---");
{
  // Absent means "show": older payloads and pre-005 rows must keep printing
  // their bank panel rather than silently losing it.
  const absent = validateDocumentPayload(newDocumentPayload());
  check("absent flag defaults to shown", absent.data?.include_bank_details, true);

  const on = validateDocumentPayload({
    ...newDocumentPayload(),
    include_bank_details: "1",
  });
  check('"1" means shown', on.data?.include_bank_details, true);

  const off = validateDocumentPayload({
    ...newDocumentPayload(),
    include_bank_details: "0",
  });
  check('"0" means hidden', off.data?.include_bank_details, false);
  check(
    "flag reaches the saved shape",
    "include_bank_details" in (off.data as Record<string, unknown>),
    true,
  );
}

console.log("\n--- malformed line_items JSON is handled, not thrown ---");
{
  const result = validateDocumentPayload({
    ...newDocumentPayload(),
    line_items: "{not json",
  });
  check("invalid JSON rejected cleanly", result.ok, false);
  check(
    "reports a line_items error",
    result.fieldErrors?.line_items,
    "Could not read the line items. Please try again.",
  );
}

console.log(
  failed === 0 ? "\nAll document validation checks passed." : `\n${failed} check(s) failed.`,
);
process.exit(failed > 0 ? 1 : 0);
