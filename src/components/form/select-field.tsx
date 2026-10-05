"use client";

import * as React from "react";
import { Controller, useFormContext, type FieldPath, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldShell, useFieldError } from "./field";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  contentClassName?: string;
  /** Fires when the user picks a value — used to stop programmatic defaults tracking them. */
  onInteracted?: () => void;
}

export function SelectField<T extends FieldValues>({
  name,
  label,
  options,
  placeholder = "Select…",
  description,
  required,
  className,
  contentClassName,
  onInteracted,
}: SelectFieldProps<T>) {
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
          <Select
            // Radix renders a hidden native <select> for form submission and
            // reads its `name` from the Root context. Without this the value
            // never reaches FormData, so server actions see the field as empty.
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={(value) => {
              onInteracted?.();
              field.onChange(value);
            }}
            disabled={field.disabled}
          >
            <SelectTrigger
              id={id}
              aria-invalid={Boolean(error)}
              className={cn(
                "h-11 w-full px-4 text-[0.9375rem] transition-all",
                "focus-visible:border-primary focus-visible:ring-0",
                error && "border-error focus-visible:ring-error/20",
              )}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className={cn("max-h-72", contentClassName)}>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldShell>
  );
}

interface NativeSelectFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  options: readonly SelectOption[];
  description?: string;
  required?: boolean;
  className?: string;
}

/** Dense variant for use inside table cells. */
export function InlineSelectField<T extends FieldValues>({
  name,
  label,
  options,
  description,
  required,
  className,
}: NativeSelectFieldProps<T>) {
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
          <select
            id={id}
            aria-label={label}
            className="h-11 w-full min-w-0 rounded-3xl border border-border bg-transparent px-4 text-[0.9375rem] outline-none transition-all focus-visible:border-primary focus-visible:ring-0"
            {...field}
            value={String(field.value ?? "")}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      />
    </FieldShell>
  );
}

export { Label };
