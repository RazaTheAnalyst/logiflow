"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";
import { ChevronDown, Copy, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES, PACKAGE_TYPES, UNITS } from "@/lib/constants";
import { parseLineItemsCsv } from "@/lib/csv";
import {
  calcCbm,
  computeTotals,
  currencySymbol,
  formatNumber,
  lineSubtotal,
  lineTax,
  round2,
} from "@/lib/money";
import type { DocumentFormValues, LineItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Card-per-row goods editor: each line item is its own card, so nothing ever
 * scrolls sideways. The Pricing / Packing toggle only switches which field
 * group is shown inside every card — description + row actions stay visible.
 */

/** Fields that only render on the Pricing tab (used to auto-open it on errors). */
const PRICING_ONLY_FIELDS = new Set([
  "part_number",
  "quantity",
  "unit",
  "unit_price",
  "discount_percent",
  "discount_amount",
  "tax_percent",
]);
/** Fields that only render on the Packing tab. */
const PACKING_ONLY_FIELDS = new Set([
  "hs_code",
  "coo",
  "carton_count",
  "package_type",
  "carton_length_cm",
  "carton_width_cm",
  "carton_height_cm",
  "net_weight_kg",
  "gross_weight_kg",
  "volume_cbm",
]);

/** Which tab owns the first line-level server error, if any (description is on both). */
function lineErrorTab(
  errors: Record<string, string> | undefined,
): "pricing" | "packing" | null {
  if (!errors) return null;
  for (const key of Object.keys(errors)) {
    if (!key.startsWith("line_items.")) continue;
    const field = key.split(".").pop() ?? "";
    if (PRICING_ONLY_FIELDS.has(field)) return "pricing";
    if (PACKING_ONLY_FIELDS.has(field)) return "packing";
  }
  return null;
}

/** Label shown above every input — always visible, card style. */
const CELL_LABEL =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const INPUT =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-sm text-heading outline-none transition-all placeholder:text-muted-foreground/50 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-error aria-invalid:ring-error/15";
const NUM_INPUT = `${INPUT} text-right tabular-nums`;

const n = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function money(symbol: string, value: number): string {
  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CellInput({
  register,
  name,
  column,
  row,
  error,
  hint,
  type = "text",
  placeholder,
  min,
  max,
  step,
  afterChange,
  className,
}: {
  register: UseFormRegister<DocumentFormValues>;
  name: FieldPath<DocumentFormValues>;
  column: string;
  row: number;
  error?: string;
  /** Derived money under Disc % / VAT % — the column header is the label. */
  hint?: string;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  /** Runs after react-hook-form has absorbed the change (e.g. sync discount). */
  afterChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Extra grid classes for the wrapper (e.g. description col-spans). */
  className?: string;
}) {
  const registration = register(name);
  return (
    <div className={cn("min-w-0", className)}>
      <span className={CELL_LABEL}>{column}</span>
      <input
        type={type}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        aria-label={`${column}, row ${row}`}
        aria-invalid={Boolean(error)}
        title={error}
        className={type === "number" ? NUM_INPUT : INPUT}
        {...registration}
        onChange={(event) => {
          registration.onChange(event);
          afterChange?.(event);
        }}
      />
      {(error || hint) && (
        <p
          className={cn(
            "truncate pt-1 text-xs leading-none tabular-nums",
            error ? "text-error" : "text-muted-foreground",
          )}
          title={error ?? hint}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/**
 * One table cell holding both halves of the discount pair: percent on top,
 * the synced money underneath. Whichever half was typed last wins; the other
 * is derived (percent → amount, amount → percent at 4 dp).
 */
function DiscountCell({
  register,
  index,
  row,
  percentError,
  amountError,
  onPercentChange,
  onAmountChange,
}: {
  register: UseFormRegister<DocumentFormValues>;
  index: number;
  row: number;
  percentError?: string;
  amountError?: string;
  onPercentChange: () => void;
  onAmountChange: () => void;
}) {
  const percent = register(`line_items.${index}.discount_percent`);
  const amount = register(`line_items.${index}.discount_amount`);
  const error = percentError ?? amountError;
  return (
    <div className="min-w-0 rounded-xl border border-dashed border-border p-3">
      <span className={CELL_LABEL}>Discount</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="0"
            aria-label={`Disc %, row ${row}`}
            aria-invalid={Boolean(percentError)}
            title={percentError}
            className={NUM_INPUT}
            {...percent}
            onChange={(event) => {
              percent.onChange(event);
              onPercentChange();
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        </div>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
            aria-hidden
          >
            −
          </span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0.00"
            aria-label={`Discount amount, row ${row}`}
            aria-invalid={Boolean(amountError)}
            title={amountError}
            className={cn(NUM_INPUT, "pl-7")}
            {...amount}
            onChange={(event) => {
              amount.onChange(event);
              onAmountChange();
            }}
          />
        </div>
      </div>
      {error && (
        <p className="truncate pt-1 text-xs leading-none text-error">{error}</p>
      )}
    </div>
  );
}

function CellSelect({
  register,
  name,
  column,
  row,
  error,
}: {
  register: UseFormRegister<DocumentFormValues>;
  name: FieldPath<DocumentFormValues>;
  column: string;
  row: number;
  error?: string;
}) {
  const registration = register(name);
  return (
    <div className="min-w-0">
      <span className={CELL_LABEL}>{column}</span>
      <div className="relative">
        <select
          aria-label={`${column}, row ${row}`}
          aria-invalid={Boolean(error)}
          title={error}
          className={cn(INPUT, "appearance-none pr-9")}
          {...registration}
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {error && (
        <p className="truncate pt-1 text-xs leading-none text-error">{error}</p>
      )}
    </div>
  );
}

export function DocumentTotalsPanel({
  currency,
}: {
  currency: string;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<DocumentFormValues>();

  const lineItems = useWatch({ control, name: "line_items" });
  const freight = useWatch({ control, name: "freight" });
  const insurance = useWatch({ control, name: "insurance" });

  const totals = useMemo(
    () =>
      computeTotals((lineItems ?? []) as LineItem[], { freight, insurance }),
    [lineItems, freight, insurance],
  );

  const symbol = `${currencySymbol(currency || "USD")} `;
  const fmt = (value: number) => money(symbol, value);
  // Discount and tax are computed from the lines now; show the effective
  // blended rate so the number explains itself.
  const effectiveDiscountPct =
    totals.subtotal > 0
      ? Math.round((totals.discount / totals.subtotal) * 10000) / 100
      : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{fmt(totals.subtotal)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Discount</span>
          <span className="tabular-nums text-muted-foreground">
            − {fmt(totals.discount)}
            {effectiveDiscountPct > 0 && (
              <span className="ml-1 text-[11px]">
                ({effectiveDiscountPct}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Freight</span>
          <span className="tabular-nums text-muted-foreground">
            + {fmt(totals.freight)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Insurance</span>
          <span className="tabular-nums text-muted-foreground">
            + {fmt(totals.insurance)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Tax / VAT</span>
          <span className="tabular-nums text-muted-foreground">
            + {fmt(totals.tax)}
            {totals.tax > 0 && (
              <span className="ml-1 text-[11px]">(per line)</span>
            )}
          </span>
        </div>
        <div className="flex items-baseline justify-between border-t border-border/20 pt-3">
          <span className="font-semibold text-heading">Total {currency}</span>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {fmt(totals.grandTotal)}
          </span>
        </div>
        {(errors.freight || errors.insurance) && (
          <p className="text-xs text-error">
            Charges cannot be negative.
          </p>
        )}
      </div>

      <div className="space-y-3.5 rounded-2xl border border-border bg-lightgray p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-heading">Shipment summary</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-muted-foreground">Line items</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.lineCount}
          </dd>
          <dt className="text-muted-foreground">Total quantity</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}
          </dd>
          <dt className="text-muted-foreground">Packages</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.cartonCount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </dd>
          <dt className="text-muted-foreground">Net weight</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.netWeightKg.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })}{" "}
            kg
          </dd>
          <dt className="text-muted-foreground">Gross weight</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.grossWeightKg.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })}{" "}
            kg
          </dd>
          <dt className="text-muted-foreground">Volume</dt>
          <dd className="text-right font-semibold tabular-nums">
            {totals.volumeCbm.toLocaleString("en-US", {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}{" "}
            CBM
          </dd>
        </dl>
      </div>
    </div>
  );
}

export function LineItemsEditor({
  fieldErrors,
  defaultView = "pricing",
}: {
  fieldErrors?: Record<string, string>;
  /** Which tab opens first — packing-first when creating a packing list. */
  defaultView?: "pricing" | "packing";
}) {
  const { control, register, formState, getValues, setValue } =
    useFormContext<DocumentFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  // Which half of the goods grid is on screen: each view owns its columns so
  // inputs stay wide enough to read and type in. A failed save must reveal
  // the tab that owns the first bad line field (cells on the other tab are
  // unmounted, so their errors live only in the summary) — a manual tab pick
  // wins until the next failed save brings a fresh error object.
  const [localView, setLocalView] = useState<"pricing" | "packing">(defaultView);
  const [manualTabFor, setManualTabFor] = useState<
    Record<string, string> | undefined
  >(undefined);
  const errorTab = lineErrorTab(fieldErrors);
  const view =
    manualTabFor === fieldErrors ? localView : (errorTab ?? localView);

  function selectTab(next: "pricing" | "packing") {
    setLocalView(next);
    setManualTabFor(fieldErrors);
  }

  const lineItems = useWatch({ control, name: "line_items" });
  const currency = useWatch({ control, name: "currency" });
  const symbol = `${currencySymbol(currency || "USD")} `;
  const fileRef = useRef<HTMLInputElement | null>(null);

  // CBM follows L × W × H ÷ 1,000,000 as soon as a dimension changes; a
  // manual value typed into the CBM field itself sticks until the next such
  // edit (or the recalculate button).
  function recomputeCbm(index: number) {
    const item = getValues(`line_items.${index}`);
    setValue(
      `line_items.${index}.volume_cbm`,
      calcCbm(
        item.carton_length_cm,
        item.carton_width_cm,
        item.carton_height_cm,
      ),
      { shouldDirty: true },
    );
  }

  // Discount percent is the intent while it is > 0: re-derive the money so a
  // qty/price edit keeps the same percentage off the new gross.
  function syncDiscountAmount(index: number) {
    const item = getValues(`line_items.${index}`);
    const pct = n(item.discount_percent);
    const gross = round2(n(item.quantity) * n(item.unit_price));
    setValue(
      `line_items.${index}.discount_amount`,
      pct > 0 ? round2((gross * pct) / 100) : 0,
      { shouldDirty: true },
    );
  }

  // Typing an amount back-fills the percent that produces it (4 dp so the
  // round trip lands on the same cent); the stored amount stays canonical.
  function syncDiscountPercent(index: number) {
    const item = getValues(`line_items.${index}`);
    const amt = n(item.discount_amount);
    const gross = round2(n(item.quantity) * n(item.unit_price));
    const pct =
      amt > 0 && gross > 0
        ? Math.round((amt / gross) * 100 * 10000) / 10000
        : 0;
    setValue(`line_items.${index}.discount_percent`, pct, {
      shouldDirty: true,
    });
  }

  function onPricedCellChange(index: number) {
    const item = getValues(`line_items.${index}`);
    if (n(item.discount_percent) > 0) syncDiscountAmount(index);
  }

  function addRow() {
    append({
      id: "",
      document_id: null,
      line_no: fields.length + 1,
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
    });
  }

  function duplicateRow(index: number) {
    const src = getValues(`line_items.${index}`);
    append({
      ...src,
      id: "",
      document_id: null,
      line_no: fields.length + 1,
      package_type: src.package_type || "CTN",
    });
  }

  async function handleCsvFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseLineItemsCsv(text);
      if (rows.length === 0) {
        toast.error("No importable rows found. Need description,quantity,unit_price headers.");
        return;
      }
      for (const row of rows) {
        append({
          id: "",
          document_id: null,
          line_no: fields.length + 1,
          description: String(row.description).slice(0, 500),
          hs_code: row.hs_code ? String(row.hs_code) : null,
          part_number: row.part_number ? String(row.part_number) : null,
          coo: row.coo ? String(row.coo) : null,
          quantity: Number(row.quantity) || 0,
          unit: row.unit ? String(row.unit).toUpperCase().slice(0, 12) : "PCS",
          unit_price: Number(row.unit_price) || 0,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: Number(row.tax_percent) || 0,
          carton_count: Number(row.carton_count) || 0,
          package_type: row.package_type
            ? String(row.package_type).toUpperCase().slice(0, 12)
            : "CTN",
          carton_length_cm: Number(row.carton_length_cm) || null,
          carton_width_cm: Number(row.carton_width_cm) || null,
          carton_height_cm: Number(row.carton_height_cm) || null,
          net_weight_kg: Number(row.net_weight_kg) || 0,
          gross_weight_kg: Number(row.gross_weight_kg) || 0,
          volume_cbm: Number(row.volume_cbm) || 0,
        });
      }
      toast.success(`${rows.length} row${rows.length === 1 ? "" : "s"} imported`);
    } catch {
      toast.error("Could not read that CSV file.");
    }
  }

  function errorFor(index: number, field: string): string | undefined {
    const serverError = fieldErrors?.[`line_items.${index}.${field}`];
    if (serverError) return serverError;
    const local = (
      formState.errors.line_items?.[index] as
        | Record<string, { message?: string } | undefined>
        | undefined
    )?.[field];
    return local?.message;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Goods columns"
          className="inline-flex rounded-full border border-border bg-muted/60 p-1"
        >
          <button
            type="button"
            aria-pressed={view === "pricing"}
            onClick={() => selectTab("pricing")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-all",
              view === "pricing"
                ? "bg-card text-primary shadow"
                : "text-muted-foreground hover:text-heading",
            )}
          >
            Pricing
          </button>
          <button
            type="button"
            aria-pressed={view === "packing"}
            onClick={() => selectTab("packing")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-all",
              view === "packing"
                ? "bg-card text-primary shadow"
                : "text-muted-foreground hover:text-heading",
            )}
          >
            Packing
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Import line items from CSV"
            onChange={(e) => {
              void handleCsvFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Import CSV
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={addRow}
          >
            <Plus />
            Add row
          </Button>
        </div>
      </div>

      <datalist id="coo-countries">
        {COUNTRIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
          <p className="text-sm font-medium text-heading">
            No goods yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first row to describe your goods.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4 gap-1.5 rounded-full"
            onClick={addRow}
          >
            <Plus />
            Add row
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => {
              const item = (lineItems?.[index] ?? {}) as Partial<LineItem>;
              const row = index + 1;
              const quantity = n(item.quantity);
              const unitPrice = n(item.unit_price);
              const discountPercent = n(item.discount_percent);
              const discountAmount = n(item.discount_amount);
              const taxPercent = n(item.tax_percent);
              const gross = lineSubtotal({ quantity, unit_price: unitPrice });
              const net = gross - (discountAmount > 0 ? discountAmount : 0);
              const tax = lineTax({
                quantity,
                unit_price: unitPrice,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                tax_percent: taxPercent,
              });

              return (
                <section
                  key={field.id}
                  aria-label={`Item ${row}`}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors focus-within:border-primary/50 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold tabular-nums text-heading">
                      {row}
                    </span>
                    <div className="min-w-0 flex-1">
                      <CellInput
                        register={register}
                        name={`line_items.${index}.description`}
                        column={`Item ${row} — Description`}
                        row={row}
                        error={errorFor(index, "description")}
                        placeholder="e.g. Cat6a Cable, 305m drum"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-7">
                      <button
                        type="button"
                        onClick={() => duplicateRow(index)}
                        aria-label={`Duplicate row ${row}`}
                        title="Duplicate row"
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-heading"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label={`Delete row ${row}`}
                        title="Delete row"
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {view === "pricing" ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <CellInput
                          register={register}
                          name={`line_items.${index}.part_number`}
                          column="Part no."
                          row={row}
                          error={errorFor(index, "part_number")}
                          placeholder="—"
                        />
                        <CellInput
                          register={register}
                          name={`line_items.${index}.quantity`}
                          column="Qty"
                          row={row}
                          type="number"
                          min={0}
                          step="any"
                          error={errorFor(index, "quantity")}
                          afterChange={() => onPricedCellChange(index)}
                        />
                        <CellSelect
                          register={register}
                          name={`line_items.${index}.unit`}
                          column="Unit"
                          row={row}
                          error={errorFor(index, "unit")}
                        />
                        <CellInput
                          register={register}
                          name={`line_items.${index}.unit_price`}
                          column="Unit price"
                          row={row}
                          type="number"
                          min={0}
                          step="any"
                          error={errorFor(index, "unit_price")}
                          afterChange={() => onPricedCellChange(index)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DiscountCell
                          register={register}
                          index={index}
                          row={row}
                          percentError={errorFor(index, "discount_percent")}
                          amountError={errorFor(index, "discount_amount")}
                          onPercentChange={() => syncDiscountAmount(index)}
                          onAmountChange={() => syncDiscountPercent(index)}
                        />
                        <CellInput
                          register={register}
                          name={`line_items.${index}.tax_percent`}
                          column="VAT %"
                          row={row}
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          error={errorFor(index, "tax_percent")}
                          hint={tax > 0 ? `+${money(symbol, tax)} VAT` : undefined}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {quantity.toLocaleString()} × {money(symbol, unitPrice)}
                          {discountAmount > 0 && (
                            <span className="ml-2 text-xs">
                              − {money(symbol, discountAmount)} disc
                            </span>
                          )}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-heading">
                          {money(symbol, net)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <CellInput
                          register={register}
                          name={`line_items.${index}.hs_code`}
                          column="HS code"
                          row={row}
                          error={errorFor(index, "hs_code")}
                          placeholder="0000.00"
                        />
                        <div className="min-w-0">
                          <span className={CELL_LABEL}>COO</span>
                          <input
                            list="coo-countries"
                            placeholder="—"
                            aria-label={`COO, row ${row}`}
                            className={INPUT}
                            {...register(`line_items.${index}.coo`)}
                          />
                          {errorFor(index, "coo") && (
                            <p className="truncate pt-1 text-xs text-error">
                              {errorFor(index, "coo")}
                            </p>
                          )}
                        </div>
                        <CellInput
                          register={register}
                          name={`line_items.${index}.part_number`}
                          column="Part no."
                          row={row}
                          error={errorFor(index, "part_number")}
                          placeholder="—"
                        />
                        <div className="min-w-0">
                          <span className={CELL_LABEL}>Pallet / Box</span>
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0"
                              aria-label={`Packages, row ${row}`}
                              aria-invalid={Boolean(errorFor(index, "carton_count"))}
                              title={errorFor(index, "carton_count")}
                              className={NUM_INPUT}
                              {...register(`line_items.${index}.carton_count`)}
                            />
                            <div className="relative">
                              <select
                                aria-label={`Package type, row ${row}`}
                                className={cn(INPUT, "w-24 appearance-none pr-8")}
                                {...register(`line_items.${index}.package_type`)}
                              >
                                {PACKAGE_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                          </div>
                          {errorFor(index, "carton_count") && (
                            <p className="truncate pt-1 text-xs text-error">
                              {errorFor(index, "carton_count")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-dashed border-border p-3">
                        <span className={CELL_LABEL}>Carton size (L × W × H cm)</span>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="L"
                            aria-label={`Length, row ${row}`}
                            className={NUM_INPUT}
                            {...register(`line_items.${index}.carton_length_cm`)}
                            onChange={(e) => {
                              register(`line_items.${index}.carton_length_cm`).onChange(e);
                              recomputeCbm(index);
                            }}
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="W"
                            aria-label={`Width, row ${row}`}
                            className={NUM_INPUT}
                            {...register(`line_items.${index}.carton_width_cm`)}
                            onChange={(e) => {
                              register(`line_items.${index}.carton_width_cm`).onChange(e);
                              recomputeCbm(index);
                            }}
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="H"
                            aria-label={`Height, row ${row}`}
                            className={NUM_INPUT}
                            {...register(`line_items.${index}.carton_height_cm`)}
                            onChange={(e) => {
                              register(`line_items.${index}.carton_height_cm`).onChange(e);
                              recomputeCbm(index);
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <CellInput
                          register={register}
                          name={`line_items.${index}.net_weight_kg`}
                          column="Net kg"
                          row={row}
                          type="number"
                          min={0}
                          step="any"
                          error={errorFor(index, "net_weight_kg")}
                        />
                        <CellInput
                          register={register}
                          name={`line_items.${index}.gross_weight_kg`}
                          column="Gross kg"
                          row={row}
                          type="number"
                          min={0}
                          step="any"
                          error={errorFor(index, "gross_weight_kg")}
                        />
                        <div className="min-w-0">
                          <span className={CELL_LABEL}>
                            <span className="inline-flex items-center gap-1.5">
                              CBM
                              <span className="rounded-full bg-lightprimary px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-primary">
                                Auto
                              </span>
                            </span>
                          </span>
                          <div className="flex h-11 items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5">
                            <span className="text-sm font-semibold tabular-nums text-heading">
                              {formatNumber(
                                calcCbm(
                                  item.carton_length_cm,
                                  item.carton_width_cm,
                                  item.carton_height_cm,
                                ),
                                4,
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">m³</span>
                          </div>
                          <p className="truncate pt-1 text-xs text-muted-foreground">
                            From L × W × H ÷ 1,000,000
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      )}

      {formState.errors.line_items?.root && (
        <p className="text-xs text-error">
          {formState.errors.line_items.root.message}
        </p>
      )}
    </div>
  );
}
