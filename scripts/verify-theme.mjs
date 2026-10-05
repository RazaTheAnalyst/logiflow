/**
 * Guards the Tailwind v4 theme contract: every `dark:` color utility must
 * resolve to a token defined in the `@theme inline` block of
 * src/app/globals.css (or a known literal). This is the regression test for
 * the `dark:text-gold` incident — the class compiled to nothing because no
 * `--color-gold` token existed.
 *
 * Run with: npm run verify:theme
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Runs from the repo root (see package.json), so relative paths resolve.
const ROOT = process.cwd();

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

// 1. Theme tokens: `--color-<name>:` inside the `@theme inline` block.
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
const themeBlock = css.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
const defined = new Set(
  [...themeBlock.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
);

// 2. Literals that are always valid without a token.
const FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const literal = new RegExp(
  `^(white|black|transparent|current|inherit|${FAMILIES})(-([1-9]00|50))?$`,
);

// 3. `dark:<utility>-<token>` occurrences across source.
const UTILITIES =
  "text|bg|border|ring|from|via|to|fill|stroke|caret|accent|decoration|placeholder|outline|divide|shadow";
const pattern = new RegExp(`\\bdark:((?:${UTILITIES})-([a-z][a-z0-9-]*(?:-[a-z0-9]+)*))`, "g");

let failures = 0;
for (const file of collectFiles(join(ROOT, "src"))) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(pattern)) {
    const [, , token] = match;
    const base = token.split("/")[0];
    if (defined.has(base) || literal.test(base)) continue;
    failures += 1;
    console.log(`FAIL  ${file} uses dark:${match[1]} with no --color-${base} token`);
  }
}

if (failures === 0) {
  console.log(
    `All dark-mode utilities resolve to theme tokens (${defined.size} tokens checked).`,
  );
} else {
  console.log(`\n${failures} undefined dark-mode token(s).`);
}
process.exit(failures > 0 ? 1 : 0);
