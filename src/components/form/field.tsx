"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldPath, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldShellProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FieldShell({
  id,
  label,
  description,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-[15px] font-semibold text-link">
        {label}
        {required && <span className="ml-0.5 text-error">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-error">{error}</p>
      ) : description ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function useFieldError<T extends FieldValues>(name: FieldPath<T>): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<T>();
  const error = errors[name];
  if (!error) return undefined;
  if ("message" in error && typeof error.message === "string") return error.message;
  return "Invalid value";
}

interface TextFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  type?: string;
  autoComplete?: string;
  readOnly?: boolean;
  list?: string;
  /** Fires on first focus — used to stop auto-assigned numbers tracking the type. */
  onInteracted?: () => void;
}

export function TextField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  required,
  className,
  inputClassName,
  type = "text",
  autoComplete,
  readOnly,
  list,
  onInteracted,
}: TextFieldProps<T>) {
  const { control } = useFormContext<T>();
  const error = useFieldError<T>(name);
  const id = React.useId();

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <input
            id={id}
            type={type}
            placeholder={placeholder}
            autoComplete={autoComplete}
            readOnly={readOnly}
            list={list}
            aria-invalid={Boolean(error)}
            className={cn(
              "flex h-11 w-full rounded-3xl border border-border bg-transparent px-4 py-2 text-[0.9375rem] transition-all outline-none",
              "placeholder:text-muted-foreground/60",
              "focus-visible:border-primary focus-visible:ring-0",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
              inputClassName,
            )}
            {...field}
            onFocus={() => onInteracted?.()}
            value={field.value ?? ""}
          />
        )}
      />
    </FieldShell>
  );
}

interface NumberFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  min?: number;
  suffix?: string;
}

export function NumberField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  required,
  className,
  min = 0,
  suffix,
}: NumberFieldProps<T>) {
  const { getValues, setValue } = useFormContext<T>();
  const error = useFieldError<T>(name);
  const id = React.useId();

  // Local string mirror so users can freely type "1." or clear the box.
  const [text, setText] = React.useState(() => {
    const current = getValues(name);
    return current === 0 || current == null ? "" : String(current);
  });
  const lastExternal = React.useRef<unknown>(getValues(name));

  React.useEffect(() => {
    const external = getValues(name);
    if (external !== lastExternal.current) {
      lastExternal.current = external;
      setText(external === 0 || external == null ? "" : String(external));
    }
  }, [getValues, name]);

  function commit(raw: string) {
    const parsed = Number.parseFloat(raw);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    lastExternal.current = safe;
    setValue(name, safe as never, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
    >
      <div className="relative">
        <input
          id={id}
          // The form submits natively (FormData from the DOM), so the input
          // must carry its name or the value never reaches the server.
          name={name}
          type="text"
          inputMode="decimal"
          placeholder={placeholder ?? "0"}
          aria-invalid={Boolean(error)}
          className={cn(
            "flex h-11 w-full rounded-3xl border border-border bg-transparent px-4 py-2 text-[0.9375rem] transition-all outline-none tabular-nums",
            "placeholder:text-muted-foreground/60",
            "focus-visible:border-primary focus-visible:ring-0",
            "aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
            suffix && "pr-12",
          )}
          value={text}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
            setText(raw);
            commit(raw);
          }}
          onBlur={() => {
            const parsed = Number.parseFloat(text);
            const safe = Number.isFinite(parsed) ? Math.max(min, parsed) : min;
            setText(safe === 0 ? "" : String(safe));
            commit(String(safe));
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

interface TextareaFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  rows?: number;
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  placeholder,
  description,
  required,
  className,
  rows = 3,
}: TextareaFieldProps<T>) {
  const { control } = useFormContext<T>();
  const error = useFieldError<T>(name);
  const id = React.useId();

  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <textarea
            id={id}
            rows={rows}
            placeholder={placeholder}
            aria-invalid={Boolean(error)}
            className={cn(
              "flex w-full rounded-3xl border border-border bg-transparent px-4 py-2.5 text-[0.9375rem] transition-all outline-none",
              "placeholder:text-muted-foreground/60",
              "focus-visible:border-primary focus-visible:ring-0",
              "aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
            )}
            {...field}
            value={field.value ?? ""}
          />
        )}
      />
    </FieldShell>
  );
}
