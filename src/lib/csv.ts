import type { ShippingDocumentWithLines } from "./types";
import { computeTotals } from "./money";

function esc(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function documentsToCsv(docs: ShippingDocumentWithLines[]): string {
  const header = [
    "doc_number",
    "doc_kind",
    "issue_date",
    "status",
    "customer",
    "currency",
    "incoterm",
    "po_number",
    "vessel",
    "lines",
    "qty",
    "packages",
    "net_kg",
    "gross_kg",
    "cbm",
    "subtotal",
    "discount",
    "freight",
    "insurance",
    "tax",
    "grand_total",
  ];
  const rows = docs.map((d) => {
    const t = computeTotals(d.line_items ?? [], {
      freight: Number(d.freight) || 0,
      insurance: Number(d.insurance) || 0,
    });
    return [
      d.doc_number,
      d.doc_kind ?? "commercial",
      d.issue_date,
      (d as { status?: string }).status ?? "draft",
      d.customer?.name ?? "",
      d.currency,
      d.incoterm ?? "",
      d.po_number ?? "",
      d.vessel ?? "",
      t.lineCount,
      t.quantity,
      t.cartonCount,
      t.netWeightKg,
      t.grossWeightKg,
      t.volumeCbm,
      t.subtotal,
      t.discount,
      t.freight,
      t.insurance,
      t.tax,
      t.grandTotal,
    ].map(esc).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedRow {
  description: string;
  quantity: number;
  unit_price: number;
  package_type?: string;
  [key: string]: string | number | undefined;
}

/** Minimal CSV parser for line-item import: description,quantity,unit_price,... */
export function parseLineItemsCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"' ) {
        if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; }
        else quoted = !quoted;
      } else if (c === "," && !quoted) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1, 201).map((line) => {
    const cells = split(line);
    const row: ParsedRow = { description: "", quantity: 1, unit_price: 0 };
    headers.forEach((h, i) => {
      const v = cells[i] ?? "";
      if (h.includes("desc")) row.description = v;
      else if (h.includes("qty") || h === "quantity") row.quantity = Number(v) || 0;
      else if (h.includes("price")) row.unit_price = Number(v) || 0;
      else if (h.includes("length") || h === "l") row.carton_length_cm = v;
      else if (h.includes("width") || h === "w") row.carton_width_cm = v;
      else if (h.includes("height") || h === "h") row.carton_height_cm = v;
      else if (h.includes("pack") || h.includes("pallet") || h.includes("box") || h === "ctn" || h.includes("package_type"))
        row.package_type = String(v).toUpperCase().slice(0, 12) || undefined;
      else row[h] = v;
    });
    return row;
  }).filter((r) => r.description.length > 0);
}
