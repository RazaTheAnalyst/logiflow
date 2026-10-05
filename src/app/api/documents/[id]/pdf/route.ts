import { getDocument, getEntity } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { renderDocumentPdf, type PdfKind } from "@/lib/pdf/documents";

export const runtime = "nodejs";

const KINDS: PdfKind[] = ["invoice", "packing_list", "both", "proforma"];

// In-memory per-user rate limit: 30 PDFs / minute. Single-instance friendly;
// use Upstash/Redis if deployed with multiple replicas.
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[id]/pdf">,
) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const doc = await getDocument(id);

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const entity = await getEntity(doc.entity_id);

  if (!entity) {
    return Response.json(
      {
        error:
          "The document's entity is missing. Run " +
          "supabase/004-entities-and-unified-documents.sql in the Supabase " +
          "SQL editor.",
      },
      { status: 500 },
    );
  }

  const requested = searchParams.get("kind");
  const kind: PdfKind = KINDS.includes(requested as PdfKind)
    ? (requested as PdfKind)
    : "invoice";

  // Proforma documents default to their invoice rendering.
  const effectiveKind: PdfKind =
    kind === "invoice" && doc.doc_kind === "proforma" ? "proforma" : kind;

  let pdf: Buffer;
  try {
    pdf = await renderDocumentPdf(doc, entity, effectiveKind);
  } catch (error) {
    console.error("PDF render failed:", error);
    const detail =
      error instanceof Error ? error.message : "Unknown render error";
    return Response.json(
      { error: "Could not generate the PDF", detail },
      { status: 500 },
    );
  }

  // Filename is the document number plus kind: INV-UAE-1007 CI.pdf,
  // INV-UAE-1007 PL.pdf, INV-UAE-1007 CIPL.pdf, PI-0001 PI.pdf.
  const label =
    effectiveKind === "packing_list"
      ? "PL"
      : effectiveKind === "both"
        ? "CIPL"
        : effectiveKind === "proforma"
          ? "PI"
          : "CI";

  const filename = safeFilename(`${doc.doc_number} ${label}.pdf`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
