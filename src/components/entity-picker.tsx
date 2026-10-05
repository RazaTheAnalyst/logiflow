"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WizardSteps } from "@/components/new-doc-steps";

export interface EntityCardData {
  id: string;
  company_name: string;
  city: string | null;
  country: string | null;
  doc_prefix: string;
  default_currency: string;
  logoUrl: string | null;
  suggestedNumber: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Step 1 of the new-document wizard: pick which entity is shipping, then move
 * on. Navigation is immediate — the choice rides in `?entity=` so refresh and
 * share keep working.
 */
export function EntityPickerStep({
  cards,
  basePath = "documents",
  step = 2,
  backHref,
  query = "",
}: {
  cards: EntityCardData[];
  basePath?: string;
  /** Commercial flow has a type step before this (2); proforma starts here (1). */
  step?: 1 | 2;
  /** Where the back button goes — the type chooser when one precedes this. */
  backHref?: string;
  /** Extra query (e.g. "doctype=packing") carried into the next step URL. */
  query?: string;
}) {
  const router = useRouter();

  if (cards.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Entities are missing</CardTitle>
          <CardDescription>
            Documents are created under an entity (branch or brand) and printed
            with its logo, address and number series. Run{" "}
            <span className="font-medium">supabase/004-entities-and-unified-documents.sql</span>{" "}
            in the Supabase SQL editor to create the first entity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/settings">
              <ArrowLeft />
              Go to settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={backHref ?? `/${basePath}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <WizardSteps current={step} />
      </div>

      <div className="space-y-1.5">
        <h1 className="bg-gradient-to-r from-primary to-[#32c5ff] bg-clip-text font-heading text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
          Who&apos;s shipping today?
        </h1>
        <p className="text-sm text-muted-foreground sm:text-[15px]">
          Pick the entity issuing this document — its logo, address, currency
          and number series follow automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="list">
        {cards.map((card, i) => {
          const place = [card.city, card.country].filter(Boolean).join(", ");
          return (
            <button
              key={card.id}
              type="button"
              role="listitem"
              onClick={() =>
                router.push(
                  `/${basePath}/new?${query ? `${query}&` : ""}entity=${card.id}`,
                )
              }
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              className="group animate-in fade-in slide-in-from-bottom-4 rounded-3xl border border-border bg-card p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-lightgray">
                  {card.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.logoUrl}
                      alt=""
                      className="size-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {initials(card.company_name)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-heading">
                    {card.company_name}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {place || "No address yet"}
                  </span>
                </span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </span>
              <span className="mt-4 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{card.doc_prefix}-series</Badge>
                <Badge variant="outline">{card.default_currency}</Badge>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                  Next
                  <span className="font-bold text-primary">
                    {card.suggestedNumber || "—"}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="size-4 shrink-0" />
        Need a new branch or brand? Add it in{" "}
        <Link href="/settings" className="font-medium text-primary hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
