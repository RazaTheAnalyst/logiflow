"use server";

import { peekNextNumber } from "@/lib/data";
import type { DocKind } from "@/lib/types";

/**
 * Previews the next number for an entity from the client (entity changed on
 * the document form). Server-side so anon keys never reach the RPC; failures
 * resolve to "" and the caller keeps its current value.
 */
export async function suggestDocNumber(
  entityId: string,
  kind: DocKind = "commercial",
): Promise<string> {
  if (!entityId) return "";
  return await peekNextNumber(entityId, kind);
}
