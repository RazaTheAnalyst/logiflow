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
import { EntityPickerStep } from "@/components/entity-picker";
import { CustomerPickerStep } from "@/components/customer-picker";

export const metadata = { title: "New proforma invoice" };

function fallbackNumber(entity: Entity): string {
  const prefix = entity.pi_prefix || "PI";
  return `${prefix}-${String(entity.pi_next_number ?? 1).padStart(4, "0")}`;
}

export default async function NewProformaPage({
  searchParams,
}: PageProps<"/proforma/new">) {
  const params = await searchParams;
  const entityParam = typeof params.entity === "string" ? params.entity : "";
  const customerParam =
    typeof params.customer === "string" ? params.customer : "";

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
        doc_prefix: entity.pi_prefix || "PI",
        default_currency: entity.default_currency,
        logoUrl: await getLogoUrl(entity.logo_path),
        suggestedNumber:
          (await peekNextNumber(entity.id, "proforma")) ||
          fallbackNumber(entity),
      })),
    );

    return (
      <div className="mx-auto w-full max-w-[1340px]">
        <EntityPickerStep cards={cards} basePath="proforma" step={1} />
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
          cards={customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            contact_person: customer.contact_person,
            email: customer.email,
            city: customer.city,
            country: customer.country,
          }))}
          docStats={Object.fromEntries(docStats)}
          entityId={chosen.id}
          entityName={chosen.company_name}
          basePath="proforma"
          step={2}
        />
      </div>
    );
  }

  // Step 3 — entity + buyer locked in, build the proforma.
  const peeked = await peekNextNumber(chosen.id, "proforma");

  return (
    <div className="mx-auto w-full max-w-[1340px]">
      <DocumentForm
        customers={customers}
        settings={settings}
        entities={entities}
        suggestedNumber={peeked || fallbackNumber(chosen)}
        fixedEntityId={chosen.id}
        fixedCustomerId={buyer.id}
        docKind="proforma"
        basePath="proforma"
        step={3}
      />
    </div>
  );
}
