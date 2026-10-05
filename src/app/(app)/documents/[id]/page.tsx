import { notFound } from "next/navigation";
import { getCompanySettings, getCustomers, getDocument, getEntities } from "@/lib/data";
import { DocumentForm } from "@/components/document-form";
import { emptyLineItem } from "@/lib/money";
import type { DocumentFormValues } from "@/lib/types";

export const metadata = { title: "Edit document" };

export default async function EditDocumentPage({
  params,
}: PageProps<"/documents/[id]">) {
  const { id } = await params;

  const [doc, customers, settings, entities] = await Promise.all([
    getDocument(id),
    getCustomers(),
    getCompanySettings(),
    getEntities(),
  ]);

  if (!doc) notFound();

  const values: DocumentFormValues & { id: string } = {
    id: doc.id,
    entity_id: doc.entity_id,
    doc_kind: doc.doc_kind ?? "commercial",
    doc_number: doc.doc_number,
    issue_date: doc.issue_date,
    customer_id: doc.customer_id,
    currency: doc.currency,
    status: (doc as { status?: string }).status ?? "draft",
    incoterm: doc.incoterm ?? "none",
    incoterm_year: doc.incoterm_year ?? 2020,
    incoterm_place: doc.incoterm_place ?? "",
    port_of_loading: doc.port_of_loading ?? "",
    port_of_destination: doc.port_of_destination ?? "",
    vessel: doc.vessel ?? "",
    po_number: doc.po_number ?? "",
    payment_terms: doc.payment_terms ?? "",
    notes: doc.notes ?? "",
    include_bank_details: doc.include_bank_details ?? true,
    freight: Number(doc.freight) || 0,
    insurance: Number(doc.insurance) || 0,
    line_items: doc.line_items.length > 0 ? doc.line_items : [emptyLineItem(1)],
  };

  return (
    <div className="mx-auto w-full max-w-[1340px]">
      <DocumentForm
        document={values}
        customers={customers}
        settings={settings}
        entities={entities}
        suggestedNumber={doc.doc_number}
      />
    </div>
  );
}
