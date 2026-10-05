export const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "AED", label: "AED — UAE Dirham", symbol: "د.إ" },
  { code: "SAR", label: "SAR — Saudi Riyal", symbol: "﷼" },
  { code: "QAR", label: "QAR — Qatari Riyal", symbol: "﷼" },
  { code: "KWD", label: "KWD — Kuwaiti Dinar", symbol: "د.ك" },
  { code: "BHD", label: "BHD — Bahraini Dinar", symbol: ".د.ب" },
  { code: "OMR", label: "OMR — Omani Rial", symbol: "﷼" },
  { code: "IDR", label: "IDR — Indonesian Rupiah", symbol: "Rp" },
  { code: "PKR", label: "PKR — Pakistani Rupee", symbol: "₨" },
  { code: "INR", label: "INR — Indian Rupee", symbol: "₹" },
  { code: "BDT", label: "BDT — Bangladeshi Taka", symbol: "৳" },
  { code: "LKR", label: "LKR — Sri Lankan Rupee", symbol: "Rs" },
  { code: "CNY", label: "CNY — Chinese Yuan", symbol: "¥" },
  { code: "JPY", label: "JPY — Japanese Yen", symbol: "¥" },
  { code: "SGD", label: "SGD — Singapore Dollar", symbol: "$" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "$" },
  { code: "CAD", label: "CAD — Canadian Dollar", symbol: "$" },
  { code: "CHF", label: "CHF — Swiss Franc", symbol: "CHF" },
  { code: "TRY", label: "TRY — Turkish Lira", symbol: "₺" },
  { code: "ZAR", label: "ZAR — South African Rand", symbol: "R" },
  { code: "NGN", label: "NGN — Nigerian Naira", symbol: "₦" },
  { code: "KES", label: "KES — Kenyan Shilling", symbol: "KSh" },
  { code: "EGP", label: "EGP — Egyptian Pound", symbol: "E£" },
  { code: "MAD", label: "MAD — Moroccan Dirham", symbol: "DH" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export const INCOTERMS = [
  { code: "EXW", label: "EXW — Ex Works" },
  { code: "FCA", label: "FCA — Free Carrier" },
  { code: "FAS", label: "FAS — Free Alongside Ship" },
  { code: "FOB", label: "FOB — Free On Board" },
  { code: "CFR", label: "CFR — Cost and Freight" },
  { code: "CIF", label: "CIF — Cost, Insurance and Freight" },
  { code: "CPT", label: "CPT — Carriage Paid To" },
  { code: "CIP", label: "CIP — Carriage and Insurance Paid To" },
  { code: "DAP", label: "DAP — Delivered At Place" },
  { code: "DPU", label: "DPU — Delivered at Place Unloaded" },
  { code: "DDP", label: "DDP — Delivered Duty Paid" },
] as const;

export const INCOTERM_CODES = INCOTERMS.map((i) => i.code);

export const UNITS = [
  "PCS",
  "CTN",
  "PKG",
  "BOX",
  "SET",
  "PAIR",
  "DOZ",
  "MTR",
  "KG",
  "LTR",
  "SET(S)",
  "ROLL",
  "BAG",
  "DRUM",
  "PALLET",
] as const;

/** Packing-unit selector shown as Pallet / Box on the packing list. */
export const PACKAGE_TYPES = [
  "CTN",
  "BOX",
  "PALLET",
  "CRATE",
  "DRUM",
  "BAG",
  "ROLL",
] as const;

export const DOC_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
  { value: "converted", label: "Converted" },
] as const;

export type DocStatus = (typeof DOC_STATUSES)[number]["value"];

export const DOC_STATUS_VALUES = DOC_STATUSES.map((s) => s.value);

export const INCOTERM_YEARS = [2020, 2010] as const;

/** Single source of truth for currency symbols — money.ts re-exports this. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "﷼",
  QAR: "﷼",
  KWD: "د.ك",
  BHD: ".د.ب",
  OMR: "﷼",
  IDR: "Rp",
  PKR: "₨",
  INR: "₹",
  BDT: "৳",
  LKR: "Rs",
  CNY: "¥",
  JPY: "¥",
  SGD: "$",
  AUD: "$",
  CAD: "$",
  CHF: "CHF",
  TRY: "₺",
  ZAR: "R",
  NGN: "₦",
  KES: "KSh",
  EGP: "E£",
  MAD: "DH",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** ISO-ish country list for COO / address dropdowns. Free text still allowed. */
export const COUNTRIES = [
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Bahrain",
  "Pakistan",
  "India",
  "Bangladesh",
  "Sri Lanka",
  "China",
  "Hong Kong",
  "Singapore",
  "Indonesia",
  "United Kingdom",
  "United States",
  "Germany",
  "Netherlands",
  "France",
  "Italy",
  "Spain",
  "Turkey",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Egypt",
  "Morocco",
] as const;

export const LOGO_BUCKET = "company-assets";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
