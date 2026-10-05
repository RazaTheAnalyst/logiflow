"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = {
  entity_id: "Entity",
  doc_number: "Document number",
  issue_date: "Issue date",
  customer_id: "Customer",
  currency: "Currency",
  incoterm: "Incoterm",
  port_of_loading: "Port of loading",
  port_of_destination: "Port of destination",
  vessel: "Vessel / Flight",
  po_number: "PO / Reference",
  payment_terms: "Payment terms",
  notes: "Notes",
  status: "Status",
  freight: "Freight",
  insurance: "Insurance",
  line_items: "Line items",
  description: "Description",
  hs_code: "HS code",
  part_number: "Part number",
  coo: "Country of origin",
  quantity: "Quantity",
  unit: "Unit",
  unit_price: "Unit price",
  discount_percent: "Discount %",
  discount_amount: "Discount amount",
  tax_percent: "VAT %",
  carton_count: "Packages",
  carton_length_cm: "Package length",
  carton_width_cm: "Package width",
  carton_height_cm: "Package height",
  net_weight_kg: "Net weight",
  gross_weight_kg: "Gross weight",
  volume_cbm: "Volume (CBM)",
};

function labelFor(key: string): string {
  const match = /^line_items\.(\d+)\.(.+)$/.exec(key);
  if (match) {
    const [, index, field] = match;
    return `Line ${Number(index) + 1} — ${FIELD_LABELS[field] ?? field}`;
  }
  return FIELD_LABELS[key] ?? key;
}

/**
 * Renders every server-side validation error by name. Table cells and select
 * boxes have no visible labels, so without this a failed save is unactionable.
 */
export function ValidationSummary({
  fieldErrors,
  className,
}: {
  fieldErrors?: Record<string, string>;
  className?: string;
}) {
  const entries = Object.entries(fieldErrors ?? {});
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border border-error/30 bg-error/5 p-5",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-error" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[0.9375rem] font-semibold text-error">
            {entries.length === 1
              ? "1 field needs attention"
              : `${entries.length} fields need attention`}
          </p>
          <ul className="space-y-1">
            {entries.map(([key, message]) => (
              <li key={key} className="text-[0.875rem] leading-relaxed text-error/90">
                <span className="font-medium">{labelFor(key)}:</span> {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export { labelFor };
