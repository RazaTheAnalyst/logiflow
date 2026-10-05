import { createClient } from "./supabase/server";

export const NOT_AUTHENTICATED = "Not authenticated. Please sign in again.";

/**
 * Resolves the calling user's id for mutating server actions. RLS already
 * limits reads to signed-in users, but writes must also refuse anonymous
 * callers explicitly instead of failing obscurely at the database.
 */
export async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
