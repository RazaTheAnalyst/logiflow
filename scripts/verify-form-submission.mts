import { validateDocumentPayload } from "../src/lib/schemas/document";
import { validateEntityPayload } from "../src/lib/schemas/entity";

/**
 * Regression guard for a bug where Radix Select values never reached FormData.
 *
 * `<Controller>` gives the field a `name` for React Hook Form, but Radix renders
 * its hidden native <select> from the `name` on `Select.Root`. Without passing
 * it through, every dropdown submitted as an empty field and the server action
 * rejected the whole document. These checks fail if a required select is absent
 * from a FormData-shaped payload.
 */
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "33333333-3333-4333-8333-333333333333";

/** Shape of Object.fromEntries(new FormData(...)) for the document builder. */
function formDataPayload(overrides: Record<string, string> = {}) {
  return {
    entity_id: ENTITY_ID,
    doc_number: "INV-1001",
    issue_date: "2026-09-28",
    customer_id: CUSTOMER_ID,
    currency: "USD",
    incoterm: "FOB",
    status: "draft",
    freight: "0",
    insurance: "0",
    line_items: JSON.stringify([
      {
        description: "Cotton T-shirts",
        hs_code: "",
        quantity: "1000",
        unit: "PCS",
        unit_price: "2.45",
        discount_percent: "5",
        discount_amount: "122.50",
        tax_percent: "15",
        carton_count: "0",
        carton_length_cm: "0",
        carton_width_cm: "0",
        carton_height_cm: "0",
        net_weight_kg: "0",
        gross_weight_kg: "0",
        volume_cbm: "0",
      },
    ]),
    ...overrides,
  };
}

console.log("--- a fully populated document submits ---");
{
  const result = validateDocumentPayload(formDataPayload());
  check("validates", result.ok, JSON.stringify(result.fieldErrors));
  check("entity_id is read from the select", result.data?.entity_id === ENTITY_ID);
  check("currency is read from the select", result.data?.currency === "USD");
  check("customer_id is read from the select", result.data?.customer_id === CUSTOMER_ID);
  check(
    "per-line discount percent reaches the payload",
    result.data?.line_items[0].discount_percent === 5,
  );
  check(
    "per-line discount amount reaches the payload",
    result.data?.line_items[0].discount_amount === 122.5,
  );
  check(
    "per-line tax percent reaches the payload",
    result.data?.line_items[0].tax_percent === 15,
  );
}

console.log("\n--- a missing dropdown is caught, not silently defaulted ---");
{
  // This is what the bug produced: a select that renders correctly but submits
  // nothing, so the server action saw `undefined` for a required field.
  for (const field of ["entity_id", "currency", "customer_id"]) {
    const payload = formDataPayload();
    delete payload[field as keyof typeof payload];
    const result = validateDocumentPayload(payload);
    check(
      `missing "${field}" is rejected`,
      !result.ok,
      "a required dropdown must not submit empty",
    );
  }
}

console.log("\n--- status is part of the document ---");
{
  const result = validateDocumentPayload(formDataPayload());
  check("status defaults to draft", result.data?.status === "draft");
  check(
    "status is carried into the saved shape",
    "status" in (result.data as Record<string, unknown>),
  );
  const sent = validateDocumentPayload(formDataPayload({ status: "sent" }));
  check("sent status accepted", sent.data?.status === "sent");
  const bogus = validateDocumentPayload(formDataPayload({ status: "bogus" }));
  check("bogus status falls back to draft", bogus.data?.status === "draft");
}

console.log("\n--- the auto-number flag rides along without breaking validation ---");
{
  // The form posts doc_number_auto as a plain hidden input so the server can
  // reserve the number atomically. Like status, it must never reach zod.
  const result = validateDocumentPayload(formDataPayload({ doc_number_auto: "1" }));
  check("validates with the flag present", result.ok, JSON.stringify(result.fieldErrors));
  check(
    "flag is not carried into the saved shape",
    !("doc_number_auto" in (result.data as Record<string, unknown>)),
  );
}

console.log("\n--- the bank-details flag rides along as 1/0, defaulting to shown ---");
{
  // The wizard posts a hidden input next to the checkbox; absence must mean
  // "show the panel", never "silently drop the bank details".
  const absent = validateDocumentPayload(formDataPayload());
  check("absent defaults to shown", absent.data?.include_bank_details === true);

  const off = validateDocumentPayload(
    formDataPayload({ include_bank_details: "0" }),
  );
  check('"0" is parsed as hidden', off.data?.include_bank_details === false);

  const on = validateDocumentPayload(
    formDataPayload({ include_bank_details: "1" }),
  );
  check('"1" is parsed as shown', on.data?.include_bank_details === true);
}

console.log("\n--- entity creation: next_number must fail with the field rule ---");
{
  const base: Record<string, unknown> = {
    company_name: "Acme Trading LLC",
    doc_prefix: "UAE-NC",
    next_number: "1",
    default_currency: "USD",
  };

  const ok = validateEntityPayload(base);
  check(
    "valid entity payload accepts",
    ok.ok,
    ok.ok ? "" : JSON.stringify(ok.fieldErrors),
  );
  if (ok.ok) check("next_number coerced from string", ok.data.next_number === 1);

  // Regression: NumberField rendered its input without a name, so FormData
  // omitted next_number entirely and the summary showed zod's raw
  // "Expected number, received nan".
  const missing: Record<string, unknown> = { ...base };
  delete missing.next_number;
  const absentResult = validateEntityPayload(missing);
  check("absent next_number is rejected", !absentResult.ok);
  const absentMessage = absentResult.ok ? "" : (absentResult.fieldErrors.next_number ?? "");
  check(
    "absent next_number gets the field rule, not raw zod text",
    absentMessage === "Next number must be 1 or greater",
    absentMessage,
  );

  const blank = validateEntityPayload({ ...base, next_number: "" });
  check("blank next_number is rejected", !blank.ok);
  const blankMessage = blank.ok ? "" : (blank.fieldErrors.next_number ?? "");
  check(
    "blank next_number gets the field rule, not raw zod text",
    blankMessage === "Next number must be 1 or greater",
    blankMessage,
  );

  const zero = validateEntityPayload({ ...base, next_number: "0" });
  check(
    "zero rejected by the min rule",
    !zero.ok && zero.fieldErrors.next_number === "Next number must be 1 or greater",
  );

  const fraction = validateEntityPayload({ ...base, next_number: "1.5" });
  check(
    "fraction rejected by the int rule",
    !fraction.ok && fraction.fieldErrors.next_number === "Enter a whole number",
  );

  const noPrefix = validateEntityPayload({ ...base, doc_prefix: "  " });
  check(
    "blank prefix rejected with its own rule",
    !noPrefix.ok && noPrefix.fieldErrors.doc_prefix === "Number prefix is required",
  );
}

console.log(failed === 0 ? "\nAll submission checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed > 0 ? 1 : 0);
