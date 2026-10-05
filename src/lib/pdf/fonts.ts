import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Inter, self-hosted from src/assets/fonts. The same files feed the web app
 * via next/font/local, so screen and PDF render with identical letterforms.
 *
 * Each weight is registered under its own family name on purpose.
 * @react-pdf/renderer v4 does not resolve `fontWeight` against several faces
 * that share one family name — registering 400/500/600/700 as "Inter" makes
 * every heavier weight resolve to the last face registered. Distinct names
 * select the right face every time.
 *
 * Registered lazily: Font.register mutates global state, so doing it at module
 * scope would run on import even for routes that never render a PDF.
 */
const FONT_DIR = join(process.cwd(), "src", "assets", "fonts");

export const FONT = {
  regular: "Inter-400",
  medium: "Inter-500",
  semibold: "Inter-600",
  bold: "Inter-700",
} as const;

const FACES = [
  { name: FONT.regular, file: "inter-400.woff" },
  { name: FONT.medium, file: "inter-500.woff" },
  { name: FONT.semibold, file: "inter-600.woff" },
  { name: FONT.bold, file: "inter-700.woff" },
] as const;

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;

  for (const face of FACES) {
    const bytes = readFileSync(join(FONT_DIR, face.file));

    Font.register({
      family: face.name,
      // Inlining the bytes keeps rendering independent of the filesystem, which
      // matters on hosts where the source tree isn't next to the bundle.
      // Font.register accepts a data URI or remote URL, not a raw Buffer.
      src: `data:font/woff;base64,${bytes.toString("base64")}`,
    });
  }

  registered = true;
}
