/** Formats an ISO date (yyyy-mm-dd) without timezone drift. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** Joins non-empty address parts into printable lines. */
export function addressLines(parts: (string | null | undefined)[]): string[] {
  return parts
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0);
}
