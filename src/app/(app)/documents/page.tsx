import { getDocuments } from "@/lib/data";
import { DocumentsPageClient, KIND_META } from "@/components/documents-table";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({
  searchParams,
}: PageProps<"/documents">) {
  const params = await searchParams;
  const query = typeof params.search === "string" ? params.search : "";

  const documents = await getDocuments({
    docKind: "commercial",
    search: query || undefined,
  });

  return (
    <DocumentsPageClient
      documents={documents}
      meta={KIND_META.commercial}
    />
  );
}
