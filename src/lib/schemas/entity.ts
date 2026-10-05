import { z } from "zod";

const optionalText = z.string().trim().default("");

/** Tolerates select/FormData blanks the same way the settings schema does. */
const requiredText = (label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(z.string().min(1, label));

export const entitySchema = z.object({
  company_name: requiredText("Company name is required"),
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .default("")
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
  website: optionalText,
  tax_id: optionalText,
  trade_license: optionalText,
  bank_name: optionalText,
  bank_account_name: optionalText,
  bank_account_number: optionalText,
  bank_swift: optionalText,
  doc_prefix: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .pipe(
      z
        .string()
        .min(1, "Number prefix is required")
        .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
    ),
  /**
   * A cleared or absent field must fail with the field's own rule — never
   * zod's raw "Expected number, received nan", which reads as an internal
   * error in the validation summary.
   */
  next_number: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value, ctx) => {
      const raw =
        typeof value === "number" ? String(value) : (value ?? "").trim();
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Next number must be 1 or greater",
        });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(
      z
        .number()
        .int("Enter a whole number")
        .min(1, "Next number must be 1 or greater"),
    ),
  default_currency: requiredText("Choose a default currency"),
  is_default: z.union([z.literal("1"), z.literal("0")]).default("0"),
});

export type EntityInput = z.infer<typeof entitySchema>;

export type EntityValidation =
  | { ok: true; data: EntityInput }
  | { ok: false; fieldErrors: Record<string, string> };

/** Validates the raw payload posted by the entity form (FormData strings). */
export function validateEntityPayload(
  payload: Record<string, unknown>,
): EntityValidation {
  const parsed = entitySchema.safeParse(payload);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  return { ok: true, data: parsed.data };
}
