import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEntity } from "@/lib/data";
import { getLogoUrl } from "@/lib/logo";
import { EntityForm } from "@/components/entity-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit entity" };

export default async function EditEntityPage({
  params,
}: PageProps<"/settings/entities/[id]">) {
  const { id } = await params;

  const entity = await getEntity(id);
  if (!entity) notFound();

  const logoUrl = await getLogoUrl(entity.logo_path);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link href="/settings">
          <ArrowLeft />
          Back to settings
        </Link>
      </Button>
      <PageHeader
        title={entity.company_name}
        description="Identity, bank details, logo and number series for this entity."
      />
      <EntityForm entity={entity} logoUrl={logoUrl} />
    </div>
  );
}
