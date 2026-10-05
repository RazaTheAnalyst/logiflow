"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reserveNextNumber } from "@/lib/data";
import { buildDocumentHeader, buildLineItems } from "@/lib/document-payload";
import { NOT_AUTHENTICATED, requireUserId } from "@/lib/require-user";
import type { DocKind } from "@/lib/types";
import {
  validateDocumentPayload,
  type DocumentInput,
} from "@/lib/schemas/document";

export type DocumentActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  documentId?: string;
} | null;

const DUPLICATE_NUMBER_MESSAGE = "This document number is already in use.";

/** Postgres 23505 on documents can only be the (entity_id, kind, number) key. */
function dbErrorState(error: { code?: string; message: string }): {
  error: string;
  fieldErrors?: Record<string, string>;
} {
  if (error.code === "23505") {
    return {
      error: DUPLICATE_NUMBER_MESSAGE,
      fieldErrors: { doc_number: DUPLICATE_NUMBER_MESSAGE },
    };
  }
  if (error.code === "P0002") {
    return { error: "Document not found. It may have been deleted." };
  }
  return { error: error.message };
}

async function persistDocument(
  values: DocumentInput,
  documentId?: string,
  autoNumber = false,
): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) return { error: NOT_AUTHENTICATED };

  const header = buildDocumentHeader(values);
  const lines = buildLineItems(values.line_items);

  // The whole save — header upsert plus wholesale line-item replace — runs
  // inside one save_document RPC call, so a crash can never leave a
  // header-only document behind.
  if (documentId) {
    const { error } = await supabase.rpc("save_document", {
      p_id: documentId,
      p_actor: userId,
      p_header: header,
      p_lines: lines,
    });
    if (error) return dbErrorState(error);
    return { id: documentId };
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    // Auto numbers are reserved inside the database (row-locked, self-healing),
    // so the previewed label can never collide with a concurrent create.
    // Proformas draw from the entity's PI series, commercial docs from INV.
    const reserved = autoNumber
      ? await reserveNextNumber(
          values.entity_id,
          (values.doc_kind || "commercial") as DocKind,
        )
      : null;
    const { data, error } = await supabase.rpc("save_document", {
      p_id: null,
      p_actor: userId,
      p_header: { ...header, doc_number: reserved ?? values.doc_number },
      p_lines: lines,
    });

    if (!error && data) {
      return { id: data as string };
    }
    if (error?.code === "23505") {
      // A reserved number still clashed: the RPC has bumped the counter
      // past it, so one more pass receives a free number. Manual numbers
      // and exhausted retries surface as a friendly field error.
      if (autoNumber && reserved !== null && attempt < 3) continue;
      return dbErrorState(error);
    }
    return dbErrorState(error ?? { message: "Could not save the document." });
  }

  return { error: "Could not save the document." };
}

export async function saveDocument(
  _prev: DocumentActionState,
  formData: FormData,
  documentId?: string,
): Promise<DocumentActionState> {
  const payload: Record<string, unknown> = Object.fromEntries(formData);
  const result = validateDocumentPayload(payload);

  if (!result.ok) {
    // Log the real keys: without this a validation failure is undiagnosable
    // from the UI, since the fields may be inside a table with no labels.
    console.error("saveDocument validation failed:", result.fieldErrors);
    return {
      error: "Please fix the highlighted fields",
      fieldErrors: result.fieldErrors,
    };
  }

  const autoNumber = formData.get("doc_number_auto") === "1" && !documentId;
  const saved = await persistDocument(
    result.data as DocumentInput,
    documentId,
    autoNumber,
  );

  if ("error" in saved) {
    return {
      error: saved.error,
      ...(saved.fieldErrors ? { fieldErrors: saved.fieldErrors } : {}),
    };
  }

  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  revalidatePath(`/documents/${saved.id}`);
  revalidatePath(`/proforma/${saved.id}`);
  return { success: true, documentId: saved.id };
}

export async function deleteDocument(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  if (!(await requireUserId())) return { error: NOT_AUTHENTICATED };
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  return {};
}

export async function cloneDocument(
  id: string,
): Promise<{ error?: string; documentId?: string }> {
  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) return { error: NOT_AUTHENTICATED };
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docError || !doc) return { error: "Document not found." };

  const kind = (doc.doc_kind ?? "commercial") as DocKind;
  const reserved = await reserveNextNumber(doc.entity_id, kind);
  const docNumber =
    reserved ??
    `${doc.doc_number}-COPY-${new Date().getTime().toString().slice(-4)}`;

  const { data: lines } = await supabase
    .from("line_items")
    .select("*")
    .eq("document_id", id)
    .order("line_no", { ascending: true });

  const { data: created, error: createError } = await supabase
    .from("documents")
    .insert({
      entity_id: doc.entity_id,
      doc_kind: kind,
      doc_number: docNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      customer_id: doc.customer_id,
      currency: doc.currency,
      incoterm: doc.incoterm,
      incoterm_year: doc.incoterm_year ?? 2020,
      incoterm_place: doc.incoterm_place,
      port_of_loading: doc.port_of_loading,
      port_of_destination: doc.port_of_destination,
      vessel: doc.vessel,
      po_number: doc.po_number,
      payment_terms: doc.payment_terms,
      include_bank_details: doc.include_bank_details ?? true,
      freight: doc.freight ?? 0,
      insurance: doc.insurance ?? 0,
      notes: doc.notes,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return { error: "This document number is already in use." };
    }
    return { error: createError.message };
  }

  if (lines && lines.length > 0) {
    const payload = lines.map((item, index) => ({
      document_id: created.id,
      line_no: index + 1,
      description: item.description,
      hs_code: item.hs_code,
      part_number: item.part_number,
      coo: item.coo,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent ?? 0,
      discount_amount: item.discount_amount ?? 0,
      tax_percent: item.tax_percent ?? 0,
      carton_count: item.carton_count ?? 0,
      package_type: item.package_type ?? "CTN",
      carton_length_cm: item.carton_length_cm,
      carton_width_cm: item.carton_width_cm,
      carton_height_cm: item.carton_height_cm,
      net_weight_kg: item.net_weight_kg ?? 0,
      gross_weight_kg: item.gross_weight_kg ?? 0,
      volume_cbm: item.volume_cbm ?? 0,
    }));
    const { error: lineError } = await supabase
      .from("line_items")
      .insert(payload);
    if (lineError) return { error: lineError.message, documentId: created.id };
  }

  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  return { documentId: created.id };
}

/**
 * Turns an accepted proforma into a commercial invoice: reserves a fresh
 * INV number and deep-copies header + lines as a new document. Creating
 * twice creates two commercial docs, so the UI confirms before invoking.
 */
export async function convertProformaToCommercial(
  id: string,
): Promise<{ error?: string; documentId?: string }> {
  const supabase = await createClient();
  const userId = await requireUserId();
  if (!userId) return { error: NOT_AUTHENTICATED };
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (docError || !doc) return { error: "Document not found." };
  if ((doc.doc_kind ?? "commercial") !== "proforma") {
    return { error: "Only proforma invoices can be converted." };
  }

  const reserved = await reserveNextNumber(doc.entity_id, "commercial");
  const docNumber =
    reserved ??
    `${doc.doc_number}-CI-${new Date().getTime().toString().slice(-4)}`;

  const { data: lines } = await supabase
    .from("line_items")
    .select("*")
    .eq("document_id", id)
    .order("line_no", { ascending: true });

  const { data: created, error: createError } = await supabase
    .from("documents")
    .insert({
      entity_id: doc.entity_id,
      doc_kind: "commercial",
      doc_number: docNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      customer_id: doc.customer_id,
      currency: doc.currency,
      incoterm: doc.incoterm,
      incoterm_year: doc.incoterm_year ?? 2020,
      incoterm_place: doc.incoterm_place,
      port_of_loading: doc.port_of_loading,
      port_of_destination: doc.port_of_destination,
      vessel: doc.vessel,
      po_number: doc.po_number,
      payment_terms: doc.payment_terms,
      include_bank_details: doc.include_bank_details ?? true,
      freight: doc.freight ?? 0,
      insurance: doc.insurance ?? 0,
      notes: doc.notes,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return { error: "This document number is already in use." };
    }
    return { error: createError.message };
  }

  if (lines && lines.length > 0) {
    const payload = lines.map((item, index) => ({
      document_id: created.id,
      line_no: index + 1,
      description: item.description,
      hs_code: item.hs_code,
      part_number: item.part_number,
      coo: item.coo,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent ?? 0,
      discount_amount: item.discount_amount ?? 0,
      tax_percent: item.tax_percent ?? 0,
      carton_count: item.carton_count ?? 0,
      package_type: item.package_type ?? "CTN",
      carton_length_cm: item.carton_length_cm,
      carton_width_cm: item.carton_width_cm,
      carton_height_cm: item.carton_height_cm,
      net_weight_kg: item.net_weight_kg ?? 0,
      gross_weight_kg: item.gross_weight_kg ?? 0,
      volume_cbm: item.volume_cbm ?? 0,
    }));
    const { error: lineError } = await supabase
      .from("line_items")
      .insert(payload);
    if (lineError) return { error: lineError.message, documentId: created.id };
  }

  revalidatePath("/documents");
  revalidatePath("/proforma");
  revalidatePath("/dashboard");
  revalidatePath(`/documents/${created.id}`);
  return { documentId: created.id };
}
