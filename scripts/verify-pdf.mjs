/**
 * Verifies generated PDFs structurally: magic bytes, page count, fonts, footer.
 * Run with: node scripts/verify-pdf.mjs <dir>
 *
 * pdfkit draws text as glyph ids against an embedded font subset and emits no
 * ToUnicode CMap, so text cannot be recovered from the stream. Page count,
 * structure and *positions* are therefore the assertions that matter here; the
 * numeric helpers they depend on are covered by scripts/verify-math.mjs.
 *
 * The footer check composes each text-run transform down to device space and
 * asserts every page carries footer-zone text (react-pdf renders fixed
 * elements with `position:absolute; bottom` off-page, so only a coordinate
 * probe catches regressions).
 *
 * The no-merge check does the same for invoice table columns: pdfkit emits
 * glyph ids with no ToUnicode CMap, so run *widths* are recovered from each
 * embedded CIDFont's /W array (plus TJ kerning) and consecutive runs on
 * one baseline that straddle a column boundary must keep a daylight gap.
 * This catches unbreakable tokens (8-digit HS codes, long country names)
 * overflowing their box into the neighbour column — the CIPL `85447000China`
 * defect. Only INV-*-invoice.pdf is checked (both.pdf shares the component
 * but its two pages would pair runs across pages).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const dir = process.argv[2] ?? "tmp-pdf-smoke";

const PAGE_HEIGHT = 792; // US Letter — matches the Netceed letterhead artwork

/** Reads /Count out of the page-tree root, which is always uncompressed. */
function pageCount(raw) {
  const pages = raw.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  return pages ? Number(pages[1]) : 0;
}

/** PDF matrix multiplication: mul(a, b) applies b first, then a. */
function mul(a, b) {
  const [a1, b1, c1, d1, e1, f1] = a;
  const [a2, b2, c2, d2, e2, f2] = b;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

/** Decompressed streams that contain text-showing operators. */
function textStreams(buffer, raw) {
  const out = [];
  const re = /stream\r?\n/g;
  let match;
  while ((match = re.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      const body = inflateSync(buffer.subarray(start, end)).toString("latin1");
      if (/Tm/.test(body)) out.push(body);
    } catch {
      /* not a flate text stream */
    }
  }
  return out;
}

/** Text-run positions in device space (top-left origin, A4 points). */
function textRuns(stream) {
      const tokens = stream.split(/\s+/);
  const stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const runs = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "q") stack.push(matrix.slice());
    else if (token === "Q") matrix = stack.pop() ?? matrix;
    else if (token === "cm" && i >= 6) {
      const next = tokens.slice(i - 6, i).map(Number);
      if (!next.some(isNaN)) matrix = mul(next, matrix);
    } else if (token === "Tm" && i >= 6) {
      const next = tokens.slice(i - 6, i).map(Number);
      if (!next.some(isNaN)) {
        const final = mul(matrix, next);
        runs.push({ x: final[4], fromTop: PAGE_HEIGHT - final[5] });
      }
    }
  }
  return runs;
}

/** Footer text sits above the letterhead's green rule (Letter page). */
function footerZoneCount(buffer, raw) {
  return textStreams(buffer, raw)
    .flatMap(textRuns)
    .filter((run) => run.fromTop >= 735 && run.fromTop <= PAGE_HEIGHT).length;
}

// Invoice table geometry in device points (mirrors the `cols` object in
// documents.tsx: 32pt margins, content 548pt on US Letter, no 4 / part 10 /
// desc 24 / hs 9 / uom 6 / weight 11 / qty 8 / price 12 / amount 16). Guards
// the two right-hand description boundaries where long part numbers or HS
// codes could bleed into the numbers.
const TABLE_LEFT = 32;
const TABLE_WIDTH = 548;
const HS_END_X = TABLE_LEFT + TABLE_WIDTH * (0.04 + 0.10 + 0.24 + 0.09);
const ORIGIN_END_X = HS_END_X + TABLE_WIDTH * 0.06;
const MIN_GAP = 2.5;

/** First indirect object block "N 0 obj … endobj" (anchored: objects start lines). */
function getObj(raw, num) {
  const m = raw.match(new RegExp(`^${num} 0 obj([\\s\\S]*?)^endobj`, "m"));
  return m ? m[1] : null;
}

/**
 * Resource name ("/F1") → { cid: true, cids: [...] }. react-pdf embeds
 * subset fonts as Type0/Identity-H with a CIDFont descendant whose /W array
 * (here always the `0 [...]` sequential form) maps each 2-byte CID shown in
 * the hex strings to its advance in 1/1000 em.
 */
function fontTable(raw) {
  const table = {};
  const dict = raw.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (!dict) return table;
  for (const [, name, objNum] of dict[1].matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) {
    const type0 = getObj(raw, objNum);
    if (!type0) continue;
    const desc = type0.match(/\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/);
    const cid = desc ? getObj(raw, desc[1]) : null;
    const w = cid ? cid.match(/\/W\s*\[\s*0\s*\[([^\]]*)\]/) : null;
    if (!w) continue;
    table[`/${name}`] = { cid: true, cids: w[1].trim().split(/\s+/).map(Number) };
  }
  return table;
}

/** Minimal content-stream tokenizer: hex/literal strings stay whole. */
function tokenize(body) {
  const tokens = [];
  const re = /(<[0-9A-Fa-f]*>|\((?:\\.|[^\\()])*\)|\[|\]|[^[\]<>()\s]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) tokens.push(m[0]);
  return tokens;
}

function hexBytes(str) {
  const h = str.slice(1, -1);
  const out = [];
  for (let i = 0; i < h.length; i += 2) {
    out.push(parseInt(h.slice(i, i + 2).padEnd(2, "0"), 16));
  }
  return out;
}

function literalBytes(str) {
  const inner = str.slice(1, -1);
  const out = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && i + 1 < inner.length) {
      const n = inner[++i];
      if (n === "n") out.push(10);
      else if (n === "r") out.push(13);
      else if (n === "t") out.push(9);
      else if (n === "b") out.push(8);
      else if (n === "f") out.push(12);
      else if (n >= "0" && n <= "7") {
        let oct = n;
        for (
          let k = 0;
          k < 2 &&
          i + 1 < inner.length &&
          inner[i + 1] >= "0" &&
          inner[i + 1] <= "7";
          k++
        ) {
          oct += inner[++i];
        }
        out.push(parseInt(oct, 8) & 0xff);
      } else out.push(n.charCodeAt(0) & 0xff);
    } else out.push(c.charCodeAt(0) & 0xff);
  }
  return out;
}

/** Text runs with device-space origin AND width (via /Widths + TJ kerning). */
function measuredRuns(body, fonts) {
  const tokens = tokenize(body);
  const stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let font = null;
  let size = 0;
  let pos = null;
  const runs = [];

  const numbers = (i, count) => {
    const vals = tokens.slice(i - count, i).map(Number);
    return vals.length === count && !vals.some(isNaN) ? vals : null;
  };
  const emit = (items) => {
    if (!pos || !font || !(size > 0)) return;
    let units = 0;
    const adv = (cid) => font.cids[cid] ?? 0;
    for (const it of items) {
      if (typeof it === "number") units -= it;
      else if (font.cid) {
        for (let k = 0; k + 1 < it.length; k += 2) {
          units += adv(it[k] * 256 + it[k + 1]);
        }
      } else for (const b of it) units += adv(b);
    }
    runs.push({ x: pos[0], fromTop: pos[1], w: (units * size) / 1000 });
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "q") stack.push(matrix.slice());
    else if (t === "Q") matrix = stack.pop() ?? matrix;
    else if (t === "cm") {
      const next = numbers(i, 6);
      if (next) matrix = mul(next, matrix);
    } else if (t === "Tf") {
      font = fonts[tokens[i - 2]] ?? null;
      const s = Number(tokens[i - 1]);
      if (!isNaN(s)) size = s;
    } else if (t === "Tm") {
      const next = numbers(i, 6);
      if (next) {
        const final = mul(matrix, next);
        pos = [final[4], PAGE_HEIGHT - final[5]];
        if (final[0] !== 0) size = Math.abs(final[0]);
      }
    } else if (t === "Tj") {
      const u = tokens[i - 1];
      if (u && (u.startsWith("<") || u.startsWith("("))) {
        emit([u.startsWith("<") ? hexBytes(u) : literalBytes(u)]);
      }
    } else if (t === "TJ" && tokens[i - 1] === "]") {
      const rev = [];
      let j = i - 2;
      while (j >= 0 && tokens[j] !== "[") {
        rev.push(tokens[j]);
        j--;
      }
      if (j >= 0) {
        const items = [];
        for (const u of rev.reverse()) {
          if (u.startsWith("<")) items.push(hexBytes(u));
          else if (u.startsWith("(")) items.push(literalBytes(u));
          else {
            const v = Number(u);
            if (!isNaN(v)) items.push(v);
          }
        }
        emit(items);
      }
    }
  }
  return runs;
}

/**
 * No text run may extend past the content box (layout uses 32pt margins, so
 * the right edge is TABLE_LEFT + TABLE_WIDTH). This catches unbreakable
 * tokens (8-digit HS codes, long country names) overflowing their column —
 * the CIPL `85447000China` defect — in any column layout. Returns the worst
 * offenders for the report.
 */
function overflowRuns(buffer, raw) {
  const fonts = fontTable(raw);
  const rightEdge = TABLE_LEFT + TABLE_WIDTH;
  return textStreams(buffer, raw)
    .flatMap((s) => measuredRuns(s, fonts))
    .filter((r) => r.w > 0 && r.x + r.w > rightEdge + 2)
    .map((r) => `x=${r.x.toFixed(1)} end=${(r.x + r.w).toFixed(1)} y=${r.fromTop.toFixed(1)}`);
}

/**
 * Consecutive same-baseline runs straddling the desc|qty or qty|price
 * boundary must keep MIN_GAP daylight. Returns { checked, bad }.
 */
function boundaryPairs(buffer, raw) {
  const fonts = fontTable(raw);
  const runs = textStreams(buffer, raw)
    .flatMap((s) => measuredRuns(s, fonts))
    .filter((r) => r.w > 0)
    .sort((a, b) => a.fromTop - b.fromTop);
  const lines = [];
  for (const r of runs) {
    const line = lines.find((l) => Math.abs(l.y - r.fromTop) <= 1);
    if (line) line.runs.push(r);
    else lines.push({ y: r.fromTop, runs: [r] });
  }
  let checked = 0;
  const bad = [];
  const bounds = [
    ["hs|origin", HS_END_X],
    ["origin|qty", ORIGIN_END_X],
  ];
  for (const { y, runs: rs } of lines) {
    rs.sort((a, b) => a.x - b.x);
    for (let i = 1; i < rs.length; i++) {
      const prevEnd = rs[i - 1].x + rs[i - 1].w;
      const nextStart = rs[i].x;
      // The left tolerance is generous on purpose: only pairs reaching the
      // boundary can merge, and short texts still assert their daylight.
      for (const [name, bx] of bounds) {
        if (prevEnd > bx - 40 && prevEnd <= bx + 1 && nextStart >= bx - 1 && nextStart < bx + 20) {
          const gap = nextStart - prevEnd;
          checked += 1;
          if (gap < MIN_GAP) bad.push(`${name} y=${y.toFixed(1)} gap=${gap.toFixed(2)}`);
        }
      }
    }
  }
  return { checked, bad };
}

const EXPECTATIONS = {
  "INV-1041-invoice.pdf": 1,
  "INV-1041-packing_list.pdf": 1,
  "INV-1041-both.pdf": 2,
  "PI-0007-proforma.pdf": 1,
};

const files = readdirSync(dir).filter((f) => f.endsWith(".pdf"));
let failures = 0;

for (const file of files) {
  const buffer = readFileSync(join(dir, file));
  const raw = buffer.toString("latin1");

  const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  const hasEof = raw.trimEnd().endsWith("%%EOF");
  const pages = pageCount(raw);
  const fonts = new Set((raw.match(/\/BaseFont\s*\/([A-Za-z0-9#+-]+)/g) ?? []));
  const expected = EXPECTATIONS[file];
  const isDocPdf = file.startsWith("INV-") || file.startsWith("PI-");
  // Single centered footer line per page (doc · company · Page x of y).
  const footerRuns = isDocPdf ? footerZoneCount(buffer, raw) : undefined;
  const footerMin = isDocPdf ? 1 * pages : undefined;
  // The invoice table must not overflow the content box (unbreakable HS
  // codes, long names) and neighbouring columns must keep daylight.
  const merge =
    file === "INV-1041-invoice.pdf" ? boundaryPairs(buffer, raw) : undefined;
  const overflow =
    file === "INV-1041-invoice.pdf" ? overflowRuns(buffer, raw) : undefined;

  const problems = [];
  if (!isPdf) problems.push("missing %PDF- header");
  if (!hasEof) problems.push("missing %%EOF trailer");
  if (pages === 0) problems.push("no page tree found");
  if (expected !== undefined && pages !== expected) {
    problems.push(`expected ${expected} page(s), got ${pages}`);
  }
  if (footerRuns !== undefined && footerRuns < footerMin) {
    problems.push(`footer missing: ${footerRuns} zone run(s), need ${footerMin}`);
  }
  if (overflow !== undefined && overflow.length > 0) {
    problems.push(`text overflows content box: ${overflow.slice(0, 3).join("; ")}`);
  }
  if (merge !== undefined && merge.bad.length > 0) {
    problems.push(`columns merge: ${merge.bad.join("; ")}`);
  }

  if (problems.length > 0) failures += 1;
  const status = problems.length === 0 ? "PASS" : "FAIL";
  console.log(
    `${status}  ${file.padEnd(30)} pages=${pages} bytes=${String(buffer.length).padStart(6)} fonts=[${[...fonts].join(" ").trim()}]` +
      (footerRuns !== undefined ? ` footer=${footerRuns}` : "") +
      (merge !== undefined ? ` merge=${merge.checked}ok` : "") +
      (problems.length ? `\n        ${problems.join("; ")}` : ""),
  );
}

if (files.length === 0) {
  console.error(`No PDFs found in ${dir}`);
  failures += 1;
}

process.exit(failures > 0 ? 1 : 0);
