import { createClient } from "./supabase/server";
import type {
  CompanySettings,
  Customer,
  DocKind,
  Entity,
  ShippingDocumentWithLines,
} from "./types";
import { num } from "./money";

export interface SettingsResult {
  settings: CompanySettings | null;
  /** Set when the row is missing or the client may not create it. */
  problem: string | null;
}

/**
 * Reads the single settings row, creating it if it is missing.
 *
 * The schema seeds this row, but a partially applied migration leaves it empty,
 * and `.single()` on zero rows is a hard error. Self-healing keeps numbering,
 * the logo and PDF export working without a manual repair step.
 *
 * A client cannot create its own RLS policy, so if the insert is rejected the
 * reason is surfaced for the operator to fix in the SQL editor.
 */
export async function loadCompanySettings(): Promise<SettingsResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return {
      settings: null,
      problem: `Could not read company settings: ${error.message}`,
    };
  }

  if (data) return { settings: data as CompanySettings, problem: null };

  const { data: seeded, error: seedError } = await supabase
    .from("company_settings")
    .upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();

  if (seedError) {
    return {
      settings: null,
      problem:
        "The company settings record is missing and this account cannot create " +
        `it (${seedError.message}). Run supabase/002-fix-settings.sql in the ` +
        "Supabase SQL editor.",
    };
  }

  return { settings: (seeded as CompanySettings | null) ?? null, problem: null };
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  return (await loadCompanySettings()).settings;
}

export async function getCustomers(): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("getCustomers:", error.message);
    return [];
  }
  return (data ?? []) as Customer[];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Customer;
}

/** All entities (branches/brands), default first — powers the form dropdown. */
export async function getEntities(): Promise<Entity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true });

  if (error) {
    console.error("getEntities:", error.message);
    return [];
  }
  return (data ?? []) as Entity[];
}

export async function getEntity(id: string): Promise<Entity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Entity;
}

/**
 * The entity a new document is created under. Falls back to the first entity
 * by name when no default flag is set, so the form always has a value.
 */
export async function getDefaultEntity(): Promise<Entity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .order("is_default", { ascending: false })
    .order("company_name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as Entity | null) ?? null;
}

export interface DocumentListFilters {
  customerId?: string;
  entityId?: string;
  docKind?: DocKind;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentListResult {
  rows: ShippingDocumentWithLines[];
  total: number;
}

export async function getDocuments(
  filters: DocumentListFilters = {},
): Promise<ShippingDocumentWithLines[]> {
  return (await getDocumentsPaged(filters)).rows;
}

export async function getDocumentsPaged(
  filters: DocumentListFilters = {},
): Promise<DocumentListResult> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  let query = supabase
    .from("documents")
    .select("*, customer:customers(*)", { count: "exact" })
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.docKind) query = query.eq("doc_kind", filters.docKind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("issue_date", filters.from);
  if (filters.to) query = query.lte("issue_date", filters.to);
  if (filters.search) {
    const term = `%${filters.search.replace(/[%,]/g, "")}%`;
    query = query.or(
      `doc_number.ilike.${term},po_number.ilike.${term},vessel.ilike.${term}`,
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("getDocuments:", error.message);
    return { rows: [], total: 0 };
  }

  const rows = (data ?? []) as ShippingDocumentWithLines[];

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: lines } = await supabase
      .from("line_items")
      .select("*")
      .in("document_id", ids);
    // Group lines per document for list totals (single extra query, not N+1).
    const grouped = new Map<string, ShippingDocumentWithLines["line_items"]>();
    for (const line of (lines ?? []) as ShippingDocumentWithLines["line_items"]) {
      const arr = grouped.get(line.document_id ?? "") ?? [];
      arr.push({ ...line, package_type: line.package_type ?? "CTN" });
      grouped.set(line.document_id ?? "", arr);
    }
    for (const row of rows) {
      (row as ShippingDocumentWithLines).line_items =
        grouped.get(row.id) ?? [];
    }
  }

  return { rows, total: count ?? rows.length };
}

export async function getDocument(
  id: string,
): Promise<ShippingDocumentWithLines | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*, customer:customers(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("getDocument:", error.message);
    return null;
  }

  const { data: lineItems, error: linesError } = await supabase
    .from("line_items")
    .select("*")
    .eq("document_id", id)
    .order("line_no", { ascending: true });

  if (linesError) console.error("getDocument lines:", linesError.message);

  return {
    ...(data as ShippingDocumentWithLines),
    doc_kind: ((data as ShippingDocumentWithLines).doc_kind ?? "commercial") as DocKind,
    line_items: ((lineItems ?? []) as ShippingDocumentWithLines["line_items"]).map(
      (item) => ({
        ...item,
        quantity: num(item.quantity),
        unit_price: num(item.unit_price),
        discount_percent: num(item.discount_percent),
        discount_amount: num(item.discount_amount),
        tax_percent: num(item.tax_percent),
        carton_count: num(item.carton_count),
        package_type: item.package_type ?? "CTN",
        net_weight_kg: num(item.net_weight_kg),
        gross_weight_kg: num(item.gross_weight_kg),
        volume_cbm: num(item.volume_cbm),
        carton_length_cm: item.carton_length_cm === null ? null : num(item.carton_length_cm),
        carton_width_cm: item.carton_width_cm === null ? null : num(item.carton_width_cm),
        carton_height_cm: item.carton_height_cm === null ? null : num(item.carton_height_cm),
      }),
    ),
  };
}

/** Previews the next number in the entity's series without consuming it. */
export async function peekNextNumber(
  entityId: string,
  kind: DocKind = "commercial",
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    kind === "proforma" ? "peek_pi_number" : "peek_doc_number",
    {
      p_entity_id: entityId,
    },
  );
  if (error) return "";
  return (data as string) ?? "";
}

/**
 * Atomically reserves the next number in the entity's series. Bumps the
 * counter inside the database (row-locked) and self-heals past any existing
 * number, so two concurrent creates can never receive the same label. Returns
 * null when the RPC is unavailable — the caller then falls back to the
 * submitted number, with duplicates surfaced as a friendly field error.
 */
export async function reserveNextNumber(
  entityId: string,
  kind: DocKind = "commercial",
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    kind === "proforma" ? "next_pi_number" : "next_doc_number",
    {
      p_entity_id: entityId,
    },
  );
  if (error) return null;
  return (data as string) ?? null;
}

export interface DashboardRecentDoc {
  id: string;
  doc_number: string;
  doc_kind?: string | null;
  issue_date: string;
  status: string | null;
  customer: { name: string } | null;
}

export interface CustomerDocStats {
  count: number;
  latestId: string | null;
  latestNumber: string | null;
  latestKind: DocKind | null;
  latestDate: string | null;
}

/**
 * Per-customer document rollup for the customers table: total count plus the
 * latest document (either kind) linking to its detail page. Single query,
 * grouped in JS; exact while the account stays under the row cap.
 */
export async function getCustomerDocStats(): Promise<
  Map<string, CustomerDocStats>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, doc_number, doc_kind, issue_date, customer_id")
    .order("issue_date", { ascending: false })
    .limit(1000);

  const stats = new Map<string, CustomerDocStats>();
  if (error) {
    console.error("getCustomerDocStats:", error.message);
    return stats;
  }

  for (const row of (data ?? []) as {
    id: string;
    doc_number: string;
    doc_kind: DocKind | null;
    issue_date: string;
    customer_id: string;
  }[]) {
    const existing = stats.get(row.customer_id);
    if (existing) {
      existing.count += 1;
    } else {
      stats.set(row.customer_id, {
        count: 1,
        latestId: row.id,
        latestNumber: row.doc_number,
        latestKind: (row.doc_kind ?? "commercial") as DocKind,
        latestDate: row.issue_date,
      });
    }
  }
  return stats;
}

export interface DashboardStats {
  customerCount: number;
  documentCount: number;
  commercialCount: number;
  proformaCount: number;
  awaitingConversion: number;
  pipeline: { draft: number; sent: number; paid: number };
  thisYearCount: number;
  thisMonthValue: number;
  thisMonthCurrency: string;
  topCustomers: { name: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  recent: DashboardRecentDoc[];
  byMonth: { key: string; label: string; count: number }[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [customers, documents] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select(
        "id, doc_number, doc_kind, issue_date, status, currency, freight, insurance, customer:customers(name)",
      )
      .order("issue_date", { ascending: false })
      .limit(500),
  ]);

  const rows = (documents.data ?? []) as unknown as (DashboardRecentDoc & {
    currency: string;
    freight: number;
    insurance: number;
    doc_kind?: string | null;
  })[];
  const isProforma = (row: { doc_kind?: string | null }) =>
    (row.doc_kind ?? "commercial") === "proforma";
  const commercialCount = rows.filter((row) => !isProforma(row)).length;
  const proformaCount = rows.filter(isProforma).length;

  const thisYear = new Date().getFullYear();
  const currentYearDocs = rows.filter(
    (row) => new Date(row.issue_date).getFullYear() === thisYear,
  );

  const monthKey = `${thisYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const thisMonthDocs = rows.filter((row) =>
    row.issue_date.startsWith(monthKey),
  );

  // Revenue proxy without line totals: freight+insurance per doc is incomplete,
  // so count value separately once line items are joined in the detail view.
  // For the tile we show document value signal via count + top customers.
  void thisMonthDocs;

  const byCustomer = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const row of rows) {
    const name = row.customer?.name ?? "Unknown";
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + 1);
    const st = row.status ?? "draft";
    byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
  }

  const byMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      count: rows.filter(
        (row) =>
          row.issue_date.slice(0, 7) ===
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      ).length,
    };
  });

  return {
    customerCount: customers.count ?? 0,
    documentCount: rows.length,
    commercialCount,
    proformaCount,
    awaitingConversion: rows.filter(
      (row) => isProforma(row) && (row.status ?? "draft") !== "converted",
    ).length,
    pipeline: (["draft", "sent", "paid"] as const).reduce(
      (acc, status) => ({
        ...acc,
        [status]: rows.filter(
          (row) => !isProforma(row) && (row.status ?? "draft") === status,
        ).length,
      }),
      { draft: 0, sent: 0, paid: 0 },
    ),
    thisYearCount: currentYearDocs.length,
    thisMonthValue: thisMonthDocs.length,
    thisMonthCurrency: "docs",
    topCustomers: [...byCustomer.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    statusBreakdown: [...byStatus.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    recent: rows.slice(0, 6),
    byMonth,
  };
}
