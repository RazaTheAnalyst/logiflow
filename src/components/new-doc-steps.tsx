"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Type" },
  { n: 2, label: "Entity" },
  { n: 3, label: "Customer" },
  { n: 4, label: "Details & goods" },
] as const;

/** Four-dot progress header for the document wizards. Steps are 1-based;
 * flows without a type step (proforma) simply start numbering at 1 = Entity. */
export function WizardSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Creation progress">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <li key={step.n} className="flex items-center gap-2">
            {i > 0 && (
              <span
                className={cn(
                  "mx-1 h-px w-8 sm:w-12",
                  done || active ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-primary text-white",
                active && "bg-primary text-white shadow-[0_0_0_4px_rgb(93_135_255/0.2)]",
                !done && !active && "bg-muted text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" /> : step.n}
            </span>
            <span
              className={cn(
                "text-sm",
                active
                  ? "font-semibold text-heading"
                  : "hidden text-muted-foreground sm:inline",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
