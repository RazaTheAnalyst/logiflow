import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  Entity,
  Customer,
  LineItem,
  ShippingDocumentWithLines,
} from "@/lib/types";
import { formatDate } from "@/lib/format";
import {
  computeTotals,
  formatMoneyCode,
  formatNumber,
  lineDiscount,
  lineNet,
  lineTax,
  num,
} from "@/lib/money";
import { FONT, registerPdfFonts } from "./fonts";
import {
  LETTER_HEIGHT,
  LETTER_WIDTH,
  getLetterheadDataUrl,
} from "./letterhead";

/* Professional theme: white space with a navy accent — coloured table
 * headers, tinted grand total, primary details. No zebra rows. */
const PRIMARY = "#0f2a44";
const PRIMARY_TINT = "#e8eef5";
const INK = "#1f2937";
const HEADING = "#0b1526";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

/** Letter page height in points — used to anchor the footer from the top
 * because react-pdf v4 mis-positions `bottom` on fixed elements (they render
 * off-page). */
const PAGE_HEIGHT = LETTER_HEIGHT;

registerPdfFonts();

const styles = StyleSheet.create({
  page: {
    paddingTop: 88,
    paddingBottom: 68,
    paddingHorizontal: 32,
    fontSize: 8.5,
    color: INK,
    fontFamily: FONT.regular,
    lineHeight: 1.4,
  },

  /* Letterhead backdrop: full-bleed, repeated on every page. */
  letterheadBg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LETTER_WIDTH,
    height: LETTER_HEIGHT,
  },

  /* Header and footer artwork comes from the letterhead backdrop. */

  /* Title: kind centered between rules; the number lives in the grid below. */
  titleBlock: { marginTop: 2 },
  titleLineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    paddingBottom: 4,
  },
  titleRule: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    marginBottom: 3,
  },
  docTitle: {
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 2,
    color: HEADING,
    textAlign: "center",
  },

  /* Clean meta: two columns, no background. */
  meta: { flexDirection: "row", gap: 24, marginTop: 5 },
  metaCol: { flex: 1 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaKey: { width: 88, color: MUTED, fontSize: 7.5 },
  metaValue: { flex: 1, fontSize: 8, color: INK },

  parties: {
    flexDirection: "row",
    gap: 24,
    marginTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 8,
  },
  party: { flex: 1 },
  partyLabel: {
    fontSize: 7,
    letterSpacing: 1,
    color: PRIMARY,
    fontFamily: FONT.bold,
    marginBottom: 3,
  },
  partyName: { fontFamily: FONT.bold, fontSize: 9, color: HEADING, marginBottom: 2 },
  partyLine: { fontSize: 8, color: INK },

  table: { marginTop: 7 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  th: {
    fontSize: 7,
    color: "#ffffff",
    fontFamily: FONT.bold,
    letterSpacing: 0.6,
    paddingRight: 6,
  },
  thRight: {
    fontSize: 7,
    color: "#ffffff",
    fontFamily: FONT.bold,
    letterSpacing: 0.6,
    textAlign: "right",
    paddingRight: 0,
  },
  td: { fontSize: 8.5, paddingRight: 6, color: INK },
  tdRight: { fontSize: 8.5, textAlign: "right", color: INK },
  tdBold: { fontSize: 8.5, fontFamily: FONT.bold, color: HEADING },
  desc: { fontSize: 8.5, color: HEADING },
  descMeta: { fontSize: 7, color: MUTED, marginTop: 1 },
  lineNote: { fontSize: 7, color: MUTED, marginTop: 1 },

  totalsBlock: { marginTop: 6, flexDirection: "row", justifyContent: "flex-end" },
  totals: { width: 220 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLabel: { color: MUTED, fontSize: 8 },
  totalValue: { fontSize: 8.5, color: INK },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1.5,
    borderTopColor: PRIMARY,
    backgroundColor: PRIMARY_TINT,
    borderRadius: 3,
  },
  grandLabel: { fontSize: 9, fontFamily: FONT.bold, color: HEADING, letterSpacing: 0.6 },
  grandValue: { fontSize: 13, fontFamily: FONT.bold, color: PRIMARY },

  footnotes: { marginTop: 6, gap: 8 },
  footnoteRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  footnoteCol: { flex: 1, paddingRight: 6 },
  footnoteTitle: {
    fontSize: 7,
    fontFamily: FONT.bold,
    letterSpacing: 1,
    color: MUTED,
    marginBottom: 2,
  },
  footnoteBody: { fontSize: 7.5, color: INK },
  bankRow: { flexDirection: "row", marginBottom: 1.5 },
  bankKey: { width: 90, color: MUTED, fontSize: 7.5 },
  bankValue: { flex: 1, fontSize: 8, color: INK },

  /* Packing summary: mirrors the table columns so each total sits under
   * its own column (spacers match #/part/desc/qty and L/W/H). */
  summaryRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  summaryGapLeft: { width: "50%" },
  summaryGapDims: { width: "16.5%" },
  summaryCellPkg: { width: "8%" },
  summaryCellWeight: { width: "11%" },
  summaryCellCbm: { width: "12.5%" },
  summaryValue: {
    fontSize: 10,
    fontFamily: FONT.bold,
    color: PRIMARY,
    textAlign: "right",
  },
  summaryLabel: { fontSize: 7, color: MUTED, marginTop: 1, textAlign: "right" },

  /* Footer sits fully above the letterhead's green bar (measured: bar top
   * ≈ 756pt, so both lines end by ~745). Fixed elements use `top`. */
  footerLine1: {
    position: "absolute",
    top: PAGE_HEIGHT - 64,
    left: 32,
    right: 32,
    fontSize: 7,
    color: INK,
    fontFamily: FONT.bold,
  },
  footerLine2: {
    position: "absolute",
    top: PAGE_HEIGHT - 54,
    left: 32,
    right: 140,
    fontSize: 7,
    color: INK,
    fontFamily: FONT.bold,
  },
  footerRight: {
    position: "absolute",
    top: PAGE_HEIGHT - 64,
    left: 140,
    right: 32,
    fontSize: 7,
    color: INK,
    textAlign: "right",
    fontFamily: FONT.bold,
  },
});

/** Drops null/blank entries so we never print empty address lines. */
function lines(...candidates: (string | null | undefined)[]): string[] {
  return candidates
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0);
}

function cityLine(...parts: (string | null | undefined)[]): string {
  return parts
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function Lines({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return (
    <>
      {values.map((value, index) => (
        <Text key={index} style={styles.partyLine}>
          {value}
        </Text>
      ))}
    </>
  );
}

/** Letterhead backdrop on every page (fixed = repeats on overflow pages). */
function LetterheadBg() {
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image src={getLetterheadDataUrl()} style={styles.letterheadBg} fixed />
  );
}

function TitleRow({ title }: { title: string }) {
  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleLineRow}>
        <View style={styles.titleRule} />
        <Text style={styles.docTitle}>{title}</Text>
        <View style={styles.titleRule} />
      </View>
    </View>
  );
}

function MetaColumns({ left, right }: { left: { label: string; value: string }[]; right: { label: string; value: string }[] }) {
  const col = (items: { label: string; value: string }[]) => (
    <View style={styles.metaCol}>
      {items.map((item, i) => (
        <View key={i} style={styles.metaRow}>
          <Text style={styles.metaKey}>{item.label}</Text>
          <Text style={styles.metaValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={styles.meta}>
      {col(left)}
      {col(right)}
    </View>
  );
}

function Footer({ entity }: { entity: Entity }) {
  const address = [
    entity.address_line1,
    entity.address_line2,
    cityLine(entity.city, entity.state, entity.postal_code),
    entity.country,
  ]
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const vatLine = [
    entity.tax_id ? `VAT ${entity.tax_id}` : "",
    entity.trade_license ? `License ${entity.trade_license}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <>
      <Text style={styles.footerLine1} fixed>
        {entity.company_name}
        {address ? ` · ${address}` : ""}
      </Text>
      {vatLine ? (
        <Text style={styles.footerLine2} fixed>
          {vatLine}
        </Text>
      ) : null}
      <Text
        style={styles.footerRight}
        fixed
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </>
  );
}

function incotermLabel(doc: ShippingDocumentWithLines): string | null {
  if (!doc.incoterm || doc.incoterm === "none") return null;
  const year = doc.incoterm_year ? ` ${doc.incoterm_year}` : "";
  const place = doc.incoterm_place ? ` — ${doc.incoterm_place}` : "";
  return `${doc.incoterm}${year}${place}`;
}

/* ------------------------------------------------------------------ */
/* Commercial invoice page                                              */
/* ------------------------------------------------------------------ */

function InvoicePage({
  doc,
  entity,
  title = "COMMERCIAL INVOICE",
  numberLabel = "Invoice no.",
}: {
  doc: ShippingDocumentWithLines;
  entity: Entity;
  title?: string;
  numberLabel?: string;
}) {
  const customer: Customer = doc.customer ?? ({} as Customer);
  const items = doc.line_items;
  const totals = computeTotals(items, {
    freight: num(doc.freight),
    insurance: num(doc.insurance),
  });

  const incotermValue = incotermLabel(doc);

  const cols = {
    no: { width: "4%" },
    part: { width: "10%" },
    desc: { width: "24%" },
    hs: { width: "9%" },
    uom: { width: "6%" },
    weight: { width: "11%" },
    qty: { width: "8%" },
    price: { width: "12%" },
    amount: { width: "16%" },
  } as const;

  const hasBank =
    doc.include_bank_details !== false &&
    (entity.bank_name || entity.bank_account_number || entity.bank_swift);

  const leftMeta = [
    { label: numberLabel, value: doc.doc_number },
    { label: "Issue date", value: formatDate(doc.issue_date) },
    { label: "Currency", value: doc.currency },
    ...(doc.po_number ? [{ label: "P.O. ref", value: doc.po_number }] : []),
  ];
  const rightMeta = [
    ...(incotermValue ? [{ label: "Incoterms", value: incotermValue }] : []),
    ...(doc.vessel ? [{ label: "Vessel", value: doc.vessel }] : []),
    ...(doc.port_of_loading || doc.port_of_destination
      ? [
          {
            label: "Route",
            value: [doc.port_of_loading, doc.port_of_destination]
              .filter(Boolean)
              .join(" to "),
          },
        ]
      : []),
  ];

  return (
    <Page size="LETTER" style={styles.page}>
      <LetterheadBg />
      <TitleRow title={title} />

      <MetaColumns left={leftMeta} right={rightMeta} />

      <View style={styles.parties}>
        <View style={styles.party}>
          <Text style={styles.partyLabel}>EXPORTER / SHIPPER</Text>
          <Text style={styles.partyName}>{entity.company_name}</Text>
          <Lines
            values={lines(
              entity.address_line1,
              entity.address_line2,
              cityLine(entity.city, entity.country),
              entity.email,
            )}
          />
        </View>
        <View style={styles.party}>
          <Text style={styles.partyLabel}>IMPORTER / CONSIGNEE</Text>
          <Text style={styles.partyName}>{customer.name ?? "—"}</Text>
          <Lines
            values={lines(
              customer.address_line1,
              customer.address_line2,
              cityLine(customer.city, customer.state, customer.postal_code),
              customer.country,
            )}
          />
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHead} fixed>
          <Text style={[styles.th, cols.no]}>#</Text>
          <Text style={[styles.th, cols.part]}>PART NO.</Text>
          <Text style={[styles.th, cols.desc]}>DESCRIPTION</Text>
          <Text style={[styles.th, cols.hs]}>HS CODE</Text>
          <Text style={[styles.th, cols.uom]}>UOM</Text>
          <Text style={[styles.thRight, cols.weight]}>WEIGHT KG</Text>
          <Text style={[styles.thRight, cols.qty]}>QTY</Text>
          <Text style={[styles.thRight, cols.price]}>UNIT PRICE</Text>
          <Text style={[styles.thRight, cols.amount]}>TOTAL</Text>
        </View>

        {items.map((item, index) => {
          const net = lineNet(item);
          const discPct = num(item.discount_percent);
          const discAmt = lineDiscount(item);
          const vatPct = num(item.tax_percent);
          return (
            <View key={item.id || index} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, cols.no]}>{index + 1}</Text>
              <Text style={[styles.desc, cols.part]}>{item.part_number || "—"}</Text>
              <View style={cols.desc}>
                <Text style={styles.desc}>{item.description}</Text>
                {item.coo ? (
                  <Text style={styles.descMeta}>COO {item.coo}</Text>
                ) : null}
                {discPct > 0 || discAmt > 0 ? (
                  <Text style={styles.lineNote}>
                    Discount{discPct > 0 ? ` ${formatNumber(discPct, 2)}%` : ""}
                    {discPct > 0 && discAmt > 0 ? " " : ""}
                    {discAmt > 0 ? `− ${formatMoneyCode(discAmt, doc.currency)}` : ""}
                  </Text>
                ) : null}
                {vatPct > 0 ? (
                  <Text style={styles.lineNote}>
                    VAT {formatNumber(vatPct, 2)}% ·{" "}
                    {formatMoneyCode(lineTax(item), doc.currency)}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.desc, cols.hs]}>{item.hs_code || "—"}</Text>
              <Text style={[styles.td, cols.uom]}>{item.unit}</Text>
              <View style={cols.weight}>
                <Text style={styles.tdRight}>
                  {formatNumber(item.gross_weight_kg)}
                </Text>
                <Text style={[styles.lineNote, { textAlign: "right" }]}>
                  {formatNumber(item.net_weight_kg)} net
                </Text>
              </View>
              <Text style={[styles.tdRight, cols.qty]}>
                {formatNumber(item.quantity, 3)}
              </Text>
              <Text style={[styles.tdRight, cols.price]}>
                {formatMoneyCode(num(item.unit_price), doc.currency)}
              </Text>
              <Text style={[styles.tdRight, styles.tdBold, cols.amount]}>
                {formatMoneyCode(net, doc.currency)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.totalsBlock}>
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatMoneyCode(totals.subtotal, doc.currency)}
            </Text>
          </View>
          {totals.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>
                − {formatMoneyCode(totals.discount, doc.currency)}
              </Text>
            </View>
          )}
          {totals.freight > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Freight</Text>
              <Text style={styles.totalValue}>
                {formatMoneyCode(totals.freight, doc.currency)}
              </Text>
            </View>
          )}
          {totals.insurance > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Insurance</Text>
              <Text style={styles.totalValue}>
                {formatMoneyCode(totals.insurance, doc.currency)}
              </Text>
            </View>
          )}
          {totals.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT</Text>
              <Text style={styles.totalValue}>
                {formatMoneyCode(totals.tax, doc.currency)}
              </Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>TOTAL</Text>
            <Text style={styles.grandValue}>
              {formatMoneyCode(totals.grandTotal, doc.currency)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footnoteRow}>
        {hasBank && (
          <View style={styles.footnoteCol}>
            <Text style={styles.footnoteTitle}>BANK DETAILS</Text>
            {(
              [
                ["Bank", entity.bank_name],
                ["Account", entity.bank_account_name],
                ["IBAN", entity.bank_account_number],
                ["SWIFT", entity.bank_swift],
              ] as const
            )
              .filter(([, value]) => Boolean(value))
              .map(([key, value], index) => (
                <View key={index} style={styles.bankRow}>
                  <Text style={styles.bankKey}>{key}</Text>
                  <Text style={styles.bankValue}>{value}</Text>
                </View>
              ))}
          </View>
        )}
        {doc.payment_terms ? (
          <View style={styles.footnoteCol}>
            <Text style={styles.footnoteTitle}>PAYMENT TERMS</Text>
            <Text style={styles.footnoteBody}>{doc.payment_terms}</Text>
          </View>
        ) : null}
        {doc.notes ? (
          <View style={styles.footnoteCol}>
            <Text style={styles.footnoteTitle}>NOTES</Text>
            <Text style={styles.footnoteBody}>{doc.notes}</Text>
          </View>
        ) : null}
      </View>

      <Footer entity={entity} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Packing list page                                                    */
/* ------------------------------------------------------------------ */

function PackingListPage({
  doc,
  entity,
}: {
  doc: ShippingDocumentWithLines;
  entity: Entity;
}) {
  const customer: Customer = doc.customer ?? ({} as Customer);
  const items = doc.line_items;
  const totals = computeTotals(items);
  const terms = incotermLabel(doc);

  const cols = {
    no: { width: "3%" },
    part: { width: "9%" },
    desc: { width: "31%" },
    qty: { width: "7%" },
    pkg: { width: "10%" },
    weight: { width: "11%" },
    l: { width: "5.5%" },
    w: { width: "5.5%" },
    h: { width: "5.5%" },
    cbm: { width: "12.5%" },
  } as const;

  const leftMeta = [
    { label: "Packing no.", value: doc.doc_number },
    { label: "Date", value: formatDate(doc.issue_date) },
    ...(doc.po_number ? [{ label: "P.O. ref", value: doc.po_number }] : []),
  ];
  const rightMeta = [
    ...(doc.vessel ? [{ label: "Vessel", value: doc.vessel }] : []),
    ...(doc.port_of_loading || doc.port_of_destination
      ? [
          {
            label: "Route",
            value: [doc.port_of_loading, doc.port_of_destination]
              .filter(Boolean)
              .join(" to "),
          },
        ]
      : []),
    ...(terms ? [{ label: "Terms", value: terms }] : []),
  ];

  return (
    <Page size="LETTER" style={styles.page}>
      <LetterheadBg />
      <TitleRow title="PACKING LIST" />

      <MetaColumns left={leftMeta} right={rightMeta} />

      <View style={styles.parties}>
        <View style={styles.party}>
          <Text style={styles.partyLabel}>EXPORTER / SHIPPER</Text>
          <Text style={styles.partyName}>{entity.company_name}</Text>
          <Lines
            values={lines(
              entity.address_line1,
              entity.address_line2,
              cityLine(entity.city, entity.country),
            )}
          />
        </View>
        <View style={styles.party}>
          <Text style={styles.partyLabel}>IMPORTER / CONSIGNEE</Text>
          <Text style={styles.partyName}>{customer.name ?? "—"}</Text>
          <Lines
            values={lines(
              customer.address_line1,
              customer.address_line2,
              cityLine(customer.city, customer.state, customer.postal_code),
              customer.country,
            )}
          />
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHead} fixed>
          <Text style={[styles.th, cols.no]}>#</Text>
          <Text style={[styles.th, cols.part]}>PART NO.</Text>
          <Text style={[styles.th, cols.desc]}>DESCRIPTION</Text>
          <Text style={[styles.thRight, cols.qty]}>QTY</Text>
          <Text style={[styles.thRight, cols.pkg]}>PACKAGES</Text>
          <Text style={[styles.thRight, cols.weight]}>WEIGHT KG</Text>
          <Text style={[styles.thRight, cols.l]}>L CM</Text>
          <Text style={[styles.thRight, cols.w]}>W CM</Text>
          <Text style={[styles.thRight, cols.h]}>H CM</Text>
          <Text style={[styles.thRight, cols.cbm]}>CBM</Text>
        </View>

        {items.map((item, index) => {
          const hs = (item.hs_code ?? "").trim();
          const coo = (item.coo ?? "").trim();
          return (
            <View key={item.id || index} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, cols.no]}>{index + 1}</Text>
              <Text style={[styles.desc, cols.part]}>{item.part_number || "—"}</Text>
              <View style={cols.desc}>
                <Text style={styles.desc}>{item.description}</Text>
                {hs ? <Text style={styles.descMeta}>HS {hs}</Text> : null}
                {coo ? <Text style={styles.descMeta}>COO {coo}</Text> : null}
              </View>
              <Text style={[styles.tdRight, cols.qty]}>
                {formatNumber(item.quantity, 3)}
              </Text>
              <View style={cols.pkg}>
                <Text style={styles.tdRight}>
                  {formatNumber(item.carton_count)}
                </Text>
                <Text style={[styles.lineNote, { textAlign: "right" }]}>
                  {item.package_type || "CTN"}
                </Text>
              </View>
              <View style={cols.weight}>
                <Text style={styles.tdRight}>
                  {formatNumber(item.gross_weight_kg)}
                </Text>
                <Text style={[styles.lineNote, { textAlign: "right" }]}>
                  {formatNumber(item.net_weight_kg)} net
                </Text>
              </View>
              <Text style={[styles.tdRight, cols.l]}>
                {num(item.carton_length_cm) > 0 ? formatNumber(num(item.carton_length_cm)) : "—"}
              </Text>
              <Text style={[styles.tdRight, cols.w]}>
                {num(item.carton_width_cm) > 0 ? formatNumber(num(item.carton_width_cm)) : "—"}
              </Text>
              <Text style={[styles.tdRight, cols.h]}>
                {num(item.carton_height_cm) > 0 ? formatNumber(num(item.carton_height_cm)) : "—"}
              </Text>
              <Text style={[styles.tdRight, cols.cbm]}>
                {formatNumber(item.volume_cbm, 3)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryRow} wrap={false}>
        <View style={styles.summaryGapLeft} />
        <View style={styles.summaryCellPkg}>
          <Text style={styles.summaryValue}>{formatNumber(totals.cartonCount)}</Text>
          <Text style={styles.summaryLabel}>PACKAGES</Text>
        </View>
        <View style={styles.summaryCellWeight}>
          <Text style={styles.summaryValue}>
            {formatNumber(totals.netWeightKg, 2)}
          </Text>
          <Text style={styles.summaryLabel}>NET KG</Text>
          <Text style={[styles.summaryValue, { marginTop: 6 }]}>
            {formatNumber(totals.grossWeightKg, 2)}
          </Text>
          <Text style={styles.summaryLabel}>GROSS KG</Text>
        </View>
        <View style={styles.summaryGapDims} />
        <View style={styles.summaryCellCbm}>
          <Text style={styles.summaryValue}>
            {formatNumber(totals.volumeCbm, 3)}
          </Text>
          <Text style={styles.summaryLabel}>CBM</Text>
        </View>
      </View>

      <View style={styles.footnotes}>
        <View>
          <Text style={styles.footnoteTitle}>MARKS & NUMBERS</Text>
          <Text style={styles.footnoteBody}>
            {doc.doc_number}  ·  {customer.name ?? "—"}
          </Text>
        </View>
        {doc.notes && (
          <View>
            <Text style={styles.footnoteTitle}>NOTES</Text>
            <Text style={styles.footnoteBody}>{doc.notes}</Text>
          </View>
        )}
      </View>

      <Footer entity={entity} />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Rendering                                                            */
/* ------------------------------------------------------------------ */

export type PdfKind = "invoice" | "packing_list" | "both" | "proforma";

export async function renderDocumentPdf(
  doc: ShippingDocumentWithLines,
  entity: Entity,
  kind: PdfKind,
): Promise<Buffer> {
  // Header/footer artwork comes from the letterhead; per-entity logos are
  // only used in the app UI (entity picker cards).
  const shared = { doc, entity };
  const isProforma = kind === "proforma" || doc.doc_kind === "proforma";

  const element =
    kind === "both" ? (
      <Document title={doc.doc_number} author={entity.company_name}>
        <InvoicePage {...shared} />
        <PackingListPage {...shared} />
      </Document>
    ) : kind === "packing_list" ? (
      <Document
        title={`${doc.doc_number} — Packing List`}
        author={entity.company_name}
      >
        <PackingListPage {...shared} />
      </Document>
    ) : isProforma ? (
      <Document
        title={`${doc.doc_number} — Proforma Invoice`}
        author={entity.company_name}
      >
        <InvoicePage
          {...shared}
          title="PROFORMA INVOICE"
          numberLabel="Proforma no."
        />
      </Document>
    ) : (
      <Document
        title={`${doc.doc_number} — Commercial Invoice`}
        author={entity.company_name}
      >
        <InvoicePage {...shared} />
      </Document>
    );

  return Buffer.from(await renderToBuffer(element));
}

export type { LineItem };
