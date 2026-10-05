import { LETTERHEAD_DATA_URL } from "./letterhead-data";

/**
 * Netceed letterhead background, baked in at build time from
 * `src/assets/letterhead.jpg` (extracted once from the brand PDF, US Letter).
 * Rendered full-bleed behind every CI / packing-list page, so the documents
 * always carry the official header (logo + tagline) and footer (green rule).
 *
 * The bytes live in `./letterhead-data` (generated, committed) instead of
 * being read from disk per request: request-time `readFileSync` depends on
 * the process working directory and on `src/` being deployed next to the
 * server, which is not true on every host (Vercel, standalone, containers).
 * A failed artwork read must never 500 the whole PDF.
 */

export function getLetterheadDataUrl(): string {
  return LETTERHEAD_DATA_URL;
}

/** US Letter in points — matches the letterhead artwork exactly. */
export const LETTER_WIDTH = 612;
export const LETTER_HEIGHT = 792;
