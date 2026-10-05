"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Files,
  Package,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardSteps } from "@/components/new-doc-steps";

export type DocTypeChoice = "commercial" | "packing" | "both";

const CHOICES: {
  value: DocTypeChoice | "proforma";
  title: string;
  description: string;
  icon: typeof FileText;
  href: string;
}[] = [
  {
    value: "commercial",
    title: "Commercial Invoice",
    description: "Bill the buyer — pricing, taxes and totals.",
    icon: FileText,
    href: "/documents/new?doctype=commercial",
  },
  {
    value: "packing",
    title: "Packing List",
    description: "Cartons, weights and volumes for the shipment.",
    icon: Package,
    href: "/documents/new?doctype=packing",
  },
  {
    value: "both",
    title: "Invoice + Packing List",
    description: "The full set — one document, both printouts.",
    icon: Files,
    href: "/documents/new?doctype=both",
  },
  {
    value: "proforma",
    title: "Proforma Invoice",
    description: "A quotation to convert once accepted.",
    icon: ReceiptText,
    href: "/proforma/new",
  },
];

/**
 * Step 0 of document creation: pick what to make. Commercial kinds share one
 * document (and number series) — the choice only tunes the builder — while
 * proforma lives in its own flow and series.
 */
export function DocTypePickerStep() {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to documents">
          <Link href="/documents">
            <ArrowLeft />
          </Link>
        </Button>
        <WizardSteps current={1} />
      </div>

      <div className="space-y-1.5">
        <h1 className="bg-gradient-to-r from-primary to-[#32c5ff] bg-clip-text font-heading text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
          What are we creating?
        </h1>
        <p className="text-sm text-muted-foreground sm:text-[15px]">
          Pick a document type — the builder adapts to what you need to print.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" role="list">
        {CHOICES.map((choice, i) => (
          <button
            key={choice.value}
            type="button"
            role="listitem"
            onClick={() => router.push(choice.href)}
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            className="group animate-in fade-in slide-in-from-bottom-4 rounded-3xl border border-border bg-card p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lightprimary">
                <choice.icon className="size-6 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-heading">
                  {choice.title}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {choice.description}
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
