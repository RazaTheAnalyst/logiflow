"use server";

import { revalidatePath } from "next/cache";
import { LOGO_BUCKET, LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { NOT_AUTHENTICATED, requireUserId } from "@/lib/require-user";
import { validateEntityPayload } from "@/lib/schemas/entity";

export type EntityActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  entityId?: string;
} | null;

export async function saveEntity(
  _prev: EntityActionState,
  formData: FormData,
  entityId?: string,
): Promise<EntityActionState> {
  const parsed = validateEntityPayload(Object.fromEntries(formData));

  if (!parsed.ok) {
    return {
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) {
    return { error: NOT_AUTHENTICATED };
  }
  const data = parsed.data;

  const row = {
    company_name: data.company_name,
    address_line1: data.address_line1 || null,
    address_line2: data.address_line2 || null,
    city: data.city || null,
    state: data.state || null,
    postal_code: data.postal_code || null,
    country: data.country || null,
    phone: data.phone || null,
    email: data.email || null,
    website: data.website || null,
    tax_id: data.tax_id || null,
    trade_license: data.trade_license || null,
    bank_name: data.bank_name || null,
    bank_account_name: data.bank_account_name || null,
    bank_account_number: data.bank_account_number || null,
    bank_swift: data.bank_swift || null,
    doc_prefix: data.doc_prefix.toUpperCase(),
    next_number: data.next_number,
    default_currency: data.default_currency,
    is_default: data.is_default === "1",
  };

  if (entityId) {
    const { error } = await supabase
      .from("entities")
      .update(row)
      .eq("id", entityId);
    if (error) return { error: mapEntityDbError(error) };

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true, entityId };
  }

  // The very first entity is always the default, whatever the form said.
  if (!row.is_default) {
    const { count } = await supabase
      .from("entities")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) === 0) row.is_default = true;
  }

  const { data: created, error } = await supabase
    .from("entities")
    .insert({ ...row, created_by: userId })
    .select("id")
    .single();

  if (error) return { error: mapEntityDbError(error) };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true, entityId: created.id };
}

/** The only realistic 23505 here is the partial unique index on is_default. */
function mapEntityDbError(error: { message: string }): string {
  if (error.message.includes("entities_default_key")) {
    return "Another entity is already marked as the default.";
  }
  return error.message;
}

export async function deleteEntity(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }

  const { count: documentCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", id);

  if ((documentCount ?? 0) > 0) {
    return {
      error:
        `This entity still has ${documentCount} document` +
        `${documentCount === 1 ? "" : "s"}. Move or delete them first.`,
    };
  }

  const { count: entityCount } = await supabase
    .from("entities")
    .select("id", { count: "exact", head: true });

  if ((entityCount ?? 0) <= 1) {
    return { error: "At least one entity is required." };
  }

  const { data: entity } = await supabase
    .from("entities")
    .select("logo_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) return { error: error.message };

  if (entity?.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([entity.logo_path]);
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return {};
}

const MAX_LOGO_BYTES = LOGO_MAX_BYTES;
const ALLOWED_LOGO_TYPES = LOGO_ALLOWED_TYPES;

export async function uploadEntityLogo(
  entityId: string,
  formData: FormData,
): Promise<{ error?: string; path?: string }> {
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Logo must be smaller than 2 MB." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Use a PNG, JPEG, WebP or SVG file." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `logo-${Date.now()}.${extension}`;

  const supabase = await createClient();
  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) return { error: error.message };

  // Remove any previous logo so the bucket doesn't grow unbounded.
  const { data: entity } = await supabase
    .from("entities")
    .select("logo_path")
    .eq("id", entityId)
    .maybeSingle();

  if (entity?.logo_path && entity.logo_path !== path) {
    await supabase.storage.from(LOGO_BUCKET).remove([entity.logo_path]);
  }

  const { error: updateError } = await supabase
    .from("entities")
    .update({ logo_path: path })
    .eq("id", entityId);

  if (updateError) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { error: updateError.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { path };
}

export async function removeEntityLogo(
  entityId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (!(await requireUserId())) {
    return { error: NOT_AUTHENTICATED };
  }

  const { data: entity } = await supabase
    .from("entities")
    .select("logo_path")
    .eq("id", entityId)
    .maybeSingle();

  if (entity?.logo_path) {
    await supabase.storage.from(LOGO_BUCKET).remove([entity.logo_path]);
  }

  const { error } = await supabase
    .from("entities")
    .update({ logo_path: null })
    .eq("id", entityId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return {};
}
