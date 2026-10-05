import { cn } from "@/lib/utils";

/**
 * Shared page header. Plain, airy heading treatment — no rule or eyebrow bar,
 * which is what separates this style from the heavier layouts.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-heading sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Small heading used above grouped settings/forms. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[0.75rem] font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
