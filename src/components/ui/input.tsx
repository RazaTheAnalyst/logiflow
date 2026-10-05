import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-3xl border border-border bg-transparent px-4 py-2 text-[0.9375rem] transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 dark:disabled:bg-white/5",
        className
      )}
      {...props}
    />
  )
}

export { Input }
