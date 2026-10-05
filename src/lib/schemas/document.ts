import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/constants";

/**
 * Optional text that tolerates the `null`s PostgREST and the form's JSON
 * serialiser can produce. `.default("")` alone is not enough: it only fires
 * for `undefined`, so a `null` would fail `z.string()`.
 */
const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

/** Same tolerance for numbers: null/empty coerce to 0 rather than NaN. */
const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  });

const nonNegative = (message: string) =>
  optionalNumber.refine((value) => value >= 0, { message });

/** A rate between 0 and 100 (percent), tolerating blanks and strings. */
const percent = (message: string) =>
  optionalNumber.refine((value) => value >= 0 && value <= 100, { message });

export const lineItemSchema = z.object({
  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(z.string().min(1, "Description is required")),
  hs_code: optionalText,
  part_number: optionalText,
  coo: optionalText,
  quantity: nonNegative("Quantity cannot be negative"),
  unit: optionalText.pipe(z.string().min(1, "Unit is required")),
  unit_price: nonNegative("Unit price cannot be negative"),
  discount_percent: percent("Discount must be between 0 and 100"),
  discount_amount: nonNegative("Discount amount cannot be negative"),
  tax_percent: percent("Tax must be between 0 and 100"),
  carton_count: nonNegative("Package count cannot be negative"),
  package_type: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const v = (typeof value === "string" ? value.trim() : "").toUpperCase();
      return v.length > 0 ? v.slice(0, 12) : "CTN";
    })
    .pipe(z.string().min(1)),
  carton_length_cm: nonNegative("Package length cannot be negative"),
  carton_width_cm: nonNegative("Package width cannot be negative"),
  carton_height_cm: nonNegative("Package height cannot be negative"),
  net_weight_kg: nonNegative("Net weight cannot be negative"),
  gross_weight_kg: nonNegative("Gross weight cannot be negative"),
  volume_cbm: nonNegative("Volume cannot be negative"),
});

export const documentSchema = z.object({
  entity_id: z
    .string()
    .trim()
    .min(1, "Select an entity")
    .pipe(z.string().uuid("Select an entity")),
  doc_kind: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) =>
      value === "proforma" ? "proforma" : "commercial",
    )
    .pipe(z.string().min(1)),
  doc_number: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(z.string().min(1, "Document number is required")),
  issue_date: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(z.string().min(1, "Issue date is required")),
  customer_id: z
    .string()
    .trim()
    .min(1, "Select a customer")
    .pipe(z.string().uuid("Select a customer")),
  currency: z.enum(CURRENCY_CODES as unknown as [string, ...string[]]),
  incoterm: optionalText,
  incoterm_year: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => {
      const parsed =
        typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
      return parsed === 2010 || parsed === 2020 ? parsed : 2020;
    }),
  incoterm_place: optionalText,
  port_of_loading: optionalText,
  port_of_destination: optionalText,
  vessel: optionalText,
  po_number: optionalText,
  payment_terms: optionalText,
  notes: optionalText,
  /**
   * Checkbox posts "1"/"0" via a hidden input; absence (older callers,
   * migrated rows defaulting on) means "show the bank panel".
   */
  include_bank_details: z
    .union([z.string(), z.boolean(), z.null(), z.undefined()])
    .transform((value) => value !== "0" && value !== false),
  freight: nonNegative("Freight cannot be negative"),
  insurance: nonNegative("Insurance cannot be negative"),
  line_items: z
    .array(lineItemSchema)
    .min(1, "Add at least one line item")
    .max(200, "Too many line items"),
});

export type DocumentInput = z.infer<typeof documentSchema>;

/**
 * Turns zod issues into keys the form can look up. A line-item issue path is
 * `["line_items", 0, "description"]`, which must become
 * `line_items.0.description` — not `line_items.line_items.0`.
 */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [head, index, field] = issue.path;
    let key: string;

    if (head === "line_items" && typeof index === "number") {
      key = `line_items.${index}${field === undefined ? "" : `.${String(field)}`}`;
    } else {
      key = String(head ?? "form");
    }

    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}

export interface DocumentValidation {
  ok: boolean;
  data?: DocumentInput;
  fieldErrors?: Record<string, string>;
}

/**
 * Validates the raw payload posted by the document builder. Accepts strings
 * (FormData) or already-parsed line items.
 */
export function validateDocumentPayload(
  payload: Record<string, unknown>,
): DocumentValidation {
  let lineItems: unknown = payload.line_items;

  if (typeof lineItems === "string") {
    try {
      lineItems = JSON.parse(lineItems);
    } catch {
      return {
        ok: false,
        fieldErrors: { line_items: "Could not read the line items. Please try again." },
      };
    }
  }

  const parsed = documentSchema.safeParse({ ...payload, line_items: lineItems });

  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  }

  return { ok: true, data: parsed.data };
}
