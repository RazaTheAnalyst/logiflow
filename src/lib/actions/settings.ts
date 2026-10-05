"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { NOT_AUTHENTICATED, requireUserId } from "@/lib/require-user";

const optionalText = z.string().trim().default("");

/**
 * Blank-but-present is fine everywhere here. A select that renders a value but
 * submits nothing would otherwise read as `undefined` and fail `min(1)`, which
 * is how a settings save can be rejected with nothing visibly wrong.
 */
const settingsSchema = z.object({
  default_payment_terms: optionalText,
  default_incoterm: z.string().trim().default("FOB"),
  default_incoterm_year: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      const n = typeof v === "number" ? v : parseInt(String(v ?? "2020"), 10);
      return n === 2010 ? 2010 : 2020;
    }),
  default_incoterm_place: optionalText,
});

export type SettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
} | null;

export async function saveCompanySettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields", fieldErrors };
  }

  const supabase = await createClient();
  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }
  const data = parsed.data;

  // Upsert, not update: a missing settings row would make an update a no-op.
  const { error } = await supabase.from("company_settings").upsert(
    {
      id: 1,
      default_payment_terms: data.default_payment_terms,
      default_incoterm: data.default_incoterm || "FOB",
      default_incoterm_year: data.default_incoterm_year,
      default_incoterm_place: data.default_incoterm_place || null,
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
