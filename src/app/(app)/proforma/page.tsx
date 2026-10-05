import { getDocuments } from "@/lib/data";
import { DocumentsPageClient, KIND_META } from "@/components/documents-table";

export const metadata = { title: "Proforma invoices" };

export default async function ProformaPage({
  searchParams,
}: PageProps<"/proforma">) {
  const params = await searchParams;
  const query = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "all";

  const documents = await getDocuments({
    docKind: "proforma",
    search: query || undefined,
  });

  return (
    <DocumentsPageClient
      documents={documents}
      meta={KIND_META.proforma}
      initialStatus={status}
    />
  );
}
