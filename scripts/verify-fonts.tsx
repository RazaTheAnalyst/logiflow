/** Verifies every Roboto weight registers and embeds under its own name. */
import { writeFileSync, mkdirSync } from "node:fs";
import { FONT, registerPdfFonts } from "../src/lib/pdf/fonts";
import { Document, Page, StyleSheet, Text, renderToBuffer } from "@react-pdf/renderer";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10 },
  regular: { fontFamily: FONT.regular },
  medium: { fontFamily: FONT.medium },
  semibold: { fontFamily: FONT.semibold },
  bold: { fontFamily: FONT.bold },
});

registerPdfFonts();

const SAMPLE = "0123456789 the quick brown fox jumps over the lazy dog";

const buffer = await renderToBuffer(
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.regular}>Regular — {SAMPLE}</Text>
      <Text style={styles.medium}>Medium — {SAMPLE}</Text>
      <Text style={styles.semibold}>SemiBold — {SAMPLE}</Text>
      <Text style={styles.bold}>Bold — {SAMPLE}</Text>
    </Page>
  </Document>,
);

// Written to its own folder so verify-pdf.mjs only inspects real documents.
mkdirSync("tmp-verify/fonts", { recursive: true });
const path = "tmp-verify/fonts/font-test.pdf";
writeFileSync(path, buffer);

const raw = buffer.toString("latin1");
check("renders a valid PDF", raw.startsWith("%PDF-"));
check("trailer is present", raw.trimEnd().endsWith("%%EOF"));

const embedded = [
  ...new Set([...raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9#+-]+)/g)].map((m) => m[1])),
];
console.log(`      embedded: ${embedded.join(", ") || "(none)"}`);

// Guards the real defect: every weight collapsing onto a single face, which is
// what @react-pdf/renderer v4 does when faces share one family name.
for (const suffix of ["Inter-Regular", "Inter-Medium", "Inter-SemiBold", "Inter-Bold"]) {
  check(
    `${suffix} is embedded as its own face`,
    embedded.some((f) => f.endsWith(suffix)),
    `embedded: ${embedded.join(", ")}`,
  );
}

check(
  "no legacy fallback font",
  !embedded.some((f) => /Helvetica|Roboto/.test(f)),
  `embedded: ${embedded.join(", ")}`,
);

console.log(
  failed === 0 ? `\nAll font checks passed (wrote ${path}).` : `\n${failed} check(s) failed.`,
);
process.exit(failed > 0 ? 1 : 0);

