import { redirect } from "next/navigation";
import {
  getCompanySettings,
  getCustomerDocStats,
  getCustomers,
  getEntities,
  peekNextNumber,
} from "@/lib/data";
import { getLogoUrl } from "@/lib/logo";
import type { Entity } from "@/lib/types";
import { DocumentForm } from "@/components/document-form";
import { DocTypePickerStep } from "@/components/doc-type-picker";
import { EntityPickerStep } from "@/components/entity-picker";
import { CustomerPickerStep } from "@/components/customer-picker";

export const metadata = { title: "New document" };

export type CommercialDocType = "commercial" | "packing" | "both";

const DOCTYPES: CommercialDocType[] = ["commercial", "packing", "both"];

function fallbackNumber(entity: Entity): string {
  return `${entity.doc_prefix}-${String(entity.next_number).padStart(4, "0")}`;
}

function customerCards(
  customers: Awaited<ReturnType<typeof getCustomers>>,
) {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    contact_person: customer.contact_person,
    email: customer.email,
    city: customer.city,
    country: customer.country,
  }));
}

export default async function NewDocumentPage({
  searchParams,
}: PageProps<"/documents/new">) {
  const params = await searchParams;
  const doctypeParam =
    typeof params.doctype === "string" ? params.doctype : "";
  const entityParam = typeof params.entity === "string" ? params.entity : "";
  const customerParam =
    typeof params.customer === "string" ? params.customer : "";

  // Step 0 — no (valid) type yet: pick what to create.
  const doctype = DOCTYPES.includes(doctypeParam as CommercialDocType)
    ? (doctypeParam as CommercialDocType)
    : null;
  if (doctypeParam === "proforma") redirect("/proforma/new");
  if (!doctype) {
    return (
      <div className="mx-auto w-full max-w-[1340px]">
        <DocTypePickerStep />
      </div>
    );
  }
  const query = `doctype=${doctype}`;

  const [customers, settings, entities, docStats] = await Promise.all([
    getCustomers(),
    getCompanySettings(),
    getEntities(),
    getCustomerDocStats(),
  ]);

  const chosen = entities.find((entity) => entity.id === entityParam) ?? null;

  // Step 1 — no (valid) entity yet: pick who is shipping.
  if (!chosen) {
    const cards = await Promise.all(
      entities.map(async (entity) => ({
        id: entity.id,
        company_name: entity.company_name,
        city: entity.city,
        country: entity.country,
        doc_prefix: entity.doc_prefix,
        default_currency: entity.default_currency,
        logoUrl: await getLogoUrl(entity.logo_path),
        suggestedNumber:
          (await peekNextNumber(entity.id)) || fallbackNumber(entity),
      })),
    );

    return (
      <div className="mx-auto w-full max-w-[1340px]">
        <EntityPickerStep
          cards={cards}
          step={2}
          backHref="/documents/new"
          query={query}
        />
      </div>
    );
  }

  const buyer =
    customers.find((customer) => customer.id === customerParam) ?? null;

  // Step 2 — entity locked in: pick the buyer (or create one inline).
  if (!buyer) {
    return (
      <div className="mx-auto w-full max-w-[1340px]">
        <CustomerPickerStep
          cards={customerCards(customers)}
          docStats={Object.fromEntries(docStats)}
          entityId={chosen.id}
          entityName={chosen.company_name}
          step={3}
          query={query}
        />
      </div>
    );
  }

  // Step 3 — type + entity + buyer locked in, build the shipment.
  const peeked = await peekNextNumber(chosen.id);

  return (
    <div className="mx-auto w-full max-w-[1340px]">
      <DocumentForm
        customers={customers}
        settings={settings}
        entities={entities}
        suggestedNumber={peeked || fallbackNumber(chosen)}
        fixedEntityId={chosen.id}
        fixedCustomerId={buyer.id}
        doctype={doctype}
        step={4}
      />
    </div>
  );
}
