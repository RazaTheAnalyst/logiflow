"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { NOT_AUTHENTICATED, requireUserId } from "@/lib/require-user";

const optionalText = z.string().trim().default("");

const customerSchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  contact_person: optionalText,
  email: z
    .string()
    .trim()
    .default("")
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
  phone: optionalText,
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  tax_id: optionalText,
  notes: optionalText,
});

export interface CustomerActionData {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  customerId?: string;
}

export type CustomerActionState = CustomerActionData | null;

function toPayload(values: z.infer<typeof customerSchema>) {
  return {
    name: values.name.trim(),
    contact_person: values.contact_person || null,
    email: values.email || null,
    phone: values.phone || null,
    address_line1: values.address_line1 || null,
    address_line2: values.address_line2 || null,
    city: values.city || null,
    state: values.state || null,
    postal_code: values.postal_code || null,
    country: values.country || null,
    tax_id: values.tax_id || null,
    notes: values.notes || null,
  };
}

function flatten(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function createCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionData> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: flatten(parsed.error) };
  }

  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) {
    return { error: NOT_AUTHENTICATED };
  }
  const { data: created, error } = await supabase
    .from("customers")
    .insert({ ...toPayload(parsed.data), created_by: userId })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/documents");
  revalidatePath("/proforma");
  return { success: true, customerId: created.id };
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionData> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: "Please fix the highlighted fields", fieldErrors: flatten(parsed.error) };
  }

  const supabase = await createClient();
  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }
  const { error } = await supabase
    .from("customers")
    .update(toPayload(parsed.data))
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);

  if (count && count > 0) {
    return {
      error: `This customer has ${count} document${count === 1 ? "" : "s"} and cannot be deleted.`,
    };
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  return {};
}
