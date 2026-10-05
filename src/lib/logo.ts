import { LOGO_BUCKET } from "./constants";
import { createClient } from "./supabase/server";

const cache = new Map<string, string | null>();

/** Resolves a stored logo path to a signed URL, memoised per process. */
export async function getLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (cache.has(path)) return cache.get(path) ?? null;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);

  const url = data?.signedUrl ?? null;
  cache.set(path, url);
  return url;
}

export function clearLogoCache(): void {
  cache.clear();
}
