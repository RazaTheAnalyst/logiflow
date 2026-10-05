import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EntityForm } from "@/components/entity-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Add entity" };

export default function NewEntityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
        <Link href="/settings">
          <ArrowLeft />
          Back to settings
        </Link>
      </Button>
      <PageHeader
        title="Add entity"
        description="A branch or brand that issues its own documents and number series."
      />
      <EntityForm />
    </div>
  );
}
