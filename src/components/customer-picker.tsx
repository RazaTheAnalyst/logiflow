"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardSteps } from "@/components/new-doc-steps";
import {
  CustomerDialog,
  CustomerSearchInput,
  CustomersEmpty,
} from "@/components/customers";
import type { CustomerDocStats } from "@/lib/data";

export interface CustomerCardData {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
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
 * Step 2 of the new-document wizard: pick the buyer, then move on. The choice
 * rides in `?entity=&customer=` so refresh and share keep working. A buyer
 * that doesn't exist yet can be created inline and is selected immediately.
 */
export function CustomerPickerStep({
  cards,
  docStats = {},
  entityId,
  entityName,
  basePath = "documents",
  step = 3,
  query = "",
}: {
  cards: CustomerCardData[];
  docStats?: Record<string, CustomerDocStats>;
  entityId: string;
  entityName: string;
  basePath?: string;
  /** Commercial flow has type + entity steps before this (3); proforma (2). */
  step?: 2 | 3;
  /** Extra query (e.g. "doctype=packing") carried into step URLs. */
  query?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const prefix = query ? `${query}&` : "";
  const entityStepHref = `/${basePath}/new?${prefix}entity=${entityId}`;
  const step4 = (customerId: string) =>
    `/${basePath}/new?${prefix}entity=${entityId}&customer=${customerId}`;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((card) =>
      [card.name, card.contact_person, card.email, card.country, card.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [cards, search]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Back to entity picker"
        >
          <Link href={entityStepHref}>
            <ArrowLeft />
          </Link>
        </Button>
        <WizardSteps current={step} />
      </div>

      <div className="space-y-1.5">
        <h1 className="bg-gradient-to-r from-primary to-[#32c5ff] bg-clip-text font-heading text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
          Who&apos;s buying?
        </h1>
        <p className="text-sm text-muted-foreground sm:text-[15px]">
          Issuing as {entityName} ·{" "}
          <Link
            href={`/${basePath}/new${query ? `?${query}` : ""}`}
            className="font-medium text-primary hover:underline"
          >
            Change entity
          </Link>
        </p>
      </div>

      {cards.length === 0 ? (
        <CustomersEmpty />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CustomerSearchInput value={search} onChange={setSearch} />
            <CustomerDialog
              onCreated={(id) => router.push(step4(id))}
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus />
                  New customer
                </Button>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border px-6 py-14 text-center">
              <Users className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No customers match “{search}”.
              </p>
              <CustomerDialog
                onCreated={(id) => router.push(step4(id))}
                trigger={
                  <Button size="sm" variant="outline" className="mt-2 gap-1.5">
                    <Plus />
                    Create “{search.trim()}”
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2" role="list">
              {filtered.map((card, i) => {
                const place = [card.city, card.country]
                  .filter(Boolean)
                  .join(", ");
                const stats = docStats[card.id];
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="listitem"
                    onClick={() => router.push(step4(card.id))}
                    style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                    className="group animate-in fade-in slide-in-from-bottom-4 rounded-3xl border border-border bg-card p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="flex items-start gap-4">
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lightprimary">
                        <span className="text-lg font-bold text-primary">
                          {initials(card.name)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-heading">
                          {card.name}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                          {card.contact_person || place || card.email || "—"}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                    </span>
                    <span className="mt-4 flex flex-wrap items-center gap-1.5">
                      {place && <Badge variant="outline">{place}</Badge>}
                      <span className="ml-auto inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                        {stats ? (
                          <>
                            <span className="font-bold text-primary">
                              {stats.count}
                            </span>
                            doc{stats.count === 1 ? "" : "s"}
                          </>
                        ) : (
                          "No docs yet"
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
