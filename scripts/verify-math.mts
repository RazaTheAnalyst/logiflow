import {
  calcCbm,
  computeTotals,
  formatMoney,
  formatMoneyCode,
  lineDiscount,
  lineSubtotal,
  lineTax,
  num,
  round2,
  round3,
  emptyLineItem,
} from "../src/lib/money";
import type { LineItem } from "../src/lib/types";

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

function line(overrides: Partial<LineItem>): LineItem {
  return { ...emptyLineItem(1), ...overrides };
}

// --- numeric coercion: Postgres numeric columns arrive as strings -----------
check("num() parses numeric string", num("12.5"), 12.5);
check("num() parses null as 0", num(null), 0);
check("num() parses undefined as 0", num(undefined), 0);
check("num() rejects garbage", num("abc"), 0);
check("num() keeps zero", num("0"), 0);

// --- rounding ---------------------------------------------------------------
check("round2 avoids float drift on 0.145", round2(0.145), 0.15);
check("round2 on 1.005", round2(1.005), 1.01);
check("round3 on 25.2000001", round3(25.2000001), 25.2);

// --- line subtotal ----------------------------------------------------------
check(
  "lineSubtotal multiplies qty x price",
  lineSubtotal({ quantity: 12000, unit_price: 2.45 }),
  29400,
);
check(
  "lineSubtotal rounds to 2dp",
  lineSubtotal({ quantity: 3, unit_price: 1.115 }),
  3.35,
);

// --- package volume (CBM = L x W x H / 1e6, dims only) ------------------------
check(
  "calcCbm: L x W x H / 1e6",
  calcCbm(60, 40, 35),
  0.084,
);
check("calcCbm: one cubic metre", calcCbm(100, 100, 100), 1);
check("calcCbm: rounds to 4dp", calcCbm(10.5, 10.5, 10.5), 0.0012);
check("calcCbm: pallet example 120x100x118", calcCbm(120, 100, 118), 1.416);
check("calcCbm: missing dims are zero, not NaN", calcCbm(null, 40, 35), 0);
check("calcCbm: all missing", calcCbm(null, null, null), 0);
check("calcCbm: garbage dims are zero", calcCbm("abc", 40, 35), 0);
check(
  "calcCbm: string numerics coerce",
  calcCbm("60", "40", "35"),
  0.084,
);

// --- per-line discount and tax ----------------------------------------------
const flat = { quantity: 10, unit_price: 100 } as const;
check(
  "lineDiscount: stored amount is canonical",
  lineDiscount({ ...flat, discount_percent: 5, discount_amount: 40 }),
  40,
);
check(
  "lineDiscount: falls back to percent when amount is 0",
  lineDiscount({ ...flat, discount_percent: 5, discount_amount: 0 }),
  50,
);
check(
  "lineDiscount: flat amount with percent 0",
  lineDiscount({ ...flat, discount_percent: 0, discount_amount: 30 }),
  30,
);
check(
  "lineDiscount: never exceeds the line gross",
  lineDiscount({ ...flat, discount_percent: 0, discount_amount: 9999 }),
  1000, // gross is 10 x 100
);
check(
  "lineDiscount: zero discount stays 0",
  lineDiscount({ ...flat, discount_percent: 0, discount_amount: 0 }),
  0,
);
check(
  "lineTax: rate 0 is 0",
  lineTax({ ...flat, discount_percent: 0, discount_amount: 0, tax_percent: 0 }),
  0,
);
check(
  "lineTax: applied to the net after discount",
  lineTax({
    ...flat,
    discount_percent: 0,
    discount_amount: 20,
    tax_percent: 5,
  }),
  49, // (1000 - 20) * 5%
);
check(
  "lineTax: rounds to 2dp",
  lineTax({
    quantity: 3,
    unit_price: 11.11,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 7.5,
  }),
  2.5, // 33.33 * 7.5% = 2.49975
);
check(
  "emptyLineItem zeroes line pricing",
    [emptyLineItem().discount_percent, emptyLineItem().discount_amount, emptyLineItem().tax_percent],
  [0, 0, 0],
);

// --- totals -----------------------------------------------------------------
// Discount and tax live on the lines now: the document only adds freight and
// insurance on top of the sums.
const items = [
  line({
    id: "a",
    quantity: 12000,
    unit_price: 2.45,
    discount_percent: 5,
    discount_amount: 1470,
    tax_percent: 0,
    carton_count: 300,
    net_weight_kg: 2400,
    gross_weight_kg: 2700,
    volume_cbm: 25.2,
  }),
  line({
    id: "b",
    quantity: 4000,
    unit_price: 5.8,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 5,
    carton_count: 120,
    net_weight_kg: 1360,
    gross_weight_kg: 1500,
    volume_cbm: 8.448,
  }),
];

const totals = computeTotals(items, {
  freight: 1200,
  insurance: 150,
});

check("subtotal", totals.subtotal, 52600); // 29400 + 23200
check("discount sums from lines", totals.discount, 1470);
check("tax sums from lines", totals.tax, 1160); // 23200 * 5%
check("carton count", totals.cartonCount, 420);
check("net weight", totals.netWeightKg, 3760);
check("gross weight", totals.grossWeightKg, 4200);
check("volume", totals.volumeCbm, 33.648);
check("grand total applies line sums + charges", totals.grandTotal, 53640); // 52600 - 1470 + 1200 + 150 + 1160
check("line count", totals.lineCount, 2);

const bare = computeTotals(items);
check(
  "no charges: grand total = subtotal - line discount + line tax",
  bare.grandTotal,
  52290, // 52600 - 1470 + 1160
);
check("empty items do not throw", computeTotals([]).grandTotal, 0);

// --- money formatting -------------------------------------------------------
check("USD uses symbol", formatMoney(1234.5, "USD"), "$ 1,234.50");
check("EUR uses symbol", formatMoney(1234.5, "EUR"), "€ 1,234.50");
check("unknown code falls back to code", formatMoney(10, "XYZ"), "XYZ 10.00");
check("negative amounts", formatMoney(-500, "USD"), "$ -500.00");
check("zero", formatMoney(0, "USD"), "$ 0.00");
check("PDF uses ISO code", formatMoneyCode(399.88, "AED"), "AED 399.88");
check("PDF code avoids symbol glyphs", formatMoneyCode(10, "QAR"), "QAR 10.00");
check("PDF code falls back to USD", formatMoneyCode(10, ""), "USD 10.00");

console.log(failed === 0 ? "\nAll math checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed > 0 ? 1 : 0);
