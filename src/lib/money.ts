import type { DocumentTotals, LineItem } from "./types";
import { CURRENCY_SYMBOLS, currencySymbol } from "./constants";

export { CURRENCY_SYMBOLS, currencySymbol };

/** Rounds to 2dp without the usual float drift (0.145 -> 0.15). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function formatMoney(amount: number, currency: string): string {
  const symbol = currencySymbol(currency);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${symbol} ${formatted}`;
}

/**
 * PDF-safe money: ISO code + amount (`AED 399.88`). Symbol glyphs for some
 * currencies (﷼, د.إ, ₨, ৳, ₺, ₦) are missing from the embedded Inter subset
 * and misrender in PDF viewers, while browsers shape them fine — so the
 * printed documents always use the Latin-only code.
 */
export function formatMoneyCode(amount: number, currency: string): string {
  const code = (currency ?? "").trim() || "USD";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${code} ${formatted}`;
}

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function lineSubtotal(item: Pick<LineItem, "quantity" | "unit_price">): number {
  return round2(num(item.quantity) * num(item.unit_price));
}

/** Net payable for one line: gross minus discount (never below zero). */
export function lineNet(
  item: Pick<
    LineItem,
    "quantity" | "unit_price" | "discount_percent" | "discount_amount"
  >,
): number {
  const gross = num(item.quantity) * num(item.unit_price);
  return round2(Math.max(gross - lineDiscount(item), 0));
}

/**
 * Package volume in cubic metres: L × W × H (cm³) ÷ 1,000,000, rounded to
 * 4dp to match the CBM field's step. Incomplete or invalid dimensions count
 * as zero rather than NaN.
 */
export function calcCbm(
  lengthCm: unknown,
  widthCm: unknown,
  heightCm: unknown,
): number {
  const value = (num(lengthCm) * num(widthCm) * num(heightCm)) / 1_000_000;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

/**
 * Money actually discounted off one line. The stored amount is canonical
 * (the form keeps it synced to whatever percent was typed); a percent-only
 * row — legacy data or a hand-built payload — falls back to the rate.
 * Never exceeds the line's gross.
 */
export function lineDiscount(
  item: Pick<
    LineItem,
    "quantity" | "unit_price" | "discount_percent" | "discount_amount"
  >,
): number {
  const gross = num(item.quantity) * num(item.unit_price);
  const stored = num(item.discount_amount);
  const rate = num(item.discount_percent);
  const off = stored > 0 ? stored : rate > 0 ? (gross * rate) / 100 : 0;
  if (!Number.isFinite(off) || off <= 0) return 0;
  return round2(Math.min(off, gross));
}

/** Tax/VAT charged on the line, applied to the net after its discount. */
export function lineTax(
  item: Pick<
    LineItem,
    | "quantity"
    | "unit_price"
    | "discount_percent"
    | "discount_amount"
    | "tax_percent"
  >,
): number {
  const rate = num(item.tax_percent);
  if (rate <= 0) return 0;
  const net = Math.max(
    num(item.quantity) * num(item.unit_price) - lineDiscount(item),
    0,
  );
  const tax = (net * rate) / 100;
  return Number.isFinite(tax) ? round2(tax) : 0;
}

export function emptyLineItem(lineNo = 1): LineItem {
  return {
    id: "",
    document_id: null,
    line_no: lineNo,
    description: "",
    hs_code: null,
    part_number: null,
    coo: null,
    quantity: 1,
    unit: "PCS",
    unit_price: 0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 0,
    carton_count: 0,
    package_type: "CTN",
    carton_length_cm: null,
    carton_width_cm: null,
    carton_height_cm: null,
    net_weight_kg: 0,
    gross_weight_kg: 0,
    volume_cbm: 0,
  };
}

export function computeTotals(
  items: LineItem[],
  extras?: { freight?: number; insurance?: number },
): DocumentTotals {
  const sum = (pick: (i: LineItem) => number) =>
    round3(items.reduce((acc, item) => acc + num(pick(item)), 0));

  const subtotal = round2(items.reduce((acc, item) => acc + lineSubtotal(item), 0));
  // Discount and tax live on the lines now: the document only carries the
  // shipment-level charges, so their totals are sums, never inputs.
  const discount = round2(
    items.reduce((acc, item) => acc + lineDiscount(item), 0),
  );
  const tax = round2(items.reduce((acc, item) => acc + lineTax(item), 0));
  const freight = num(extras?.freight);
  const insurance = num(extras?.insurance);

  return {
    lineCount: items.length,
    quantity: sum((i) => i.quantity),
    cartonCount: sum((i) => i.carton_count),
    netWeightKg: sum((i) => i.net_weight_kg),
    grossWeightKg: sum((i) => i.gross_weight_kg),
    volumeCbm: round3(sum((i) => i.volume_cbm)),
    subtotal,
    discount,
    freight,
    insurance,
    tax,
    grandTotal: round2(subtotal - discount + freight + insurance + tax),
  };
}

/** Postgres numeric columns arrive as strings over PostgREST. */
export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
