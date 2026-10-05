"use client";

import { useActionState, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FileText, Loader2, Save } from "lucide-react";
import {
  saveCompanySettings,
  type SettingsActionState,
} from "@/lib/actions/settings";
import { INCOTERMS } from "@/lib/constants";
import type { CompanySettings, CompanySettingsFormValues } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TextareaField, TextField } from "@/components/form/field";
import { SelectField } from "@/components/form/select-field";
import { ValidationSummary } from "@/components/form/error-summary";
import { useSubmitGate } from "@/components/form/submit-gate";

const FALLBACK: CompanySettingsFormValues = {
  default_payment_terms: "",
  default_incoterm: "FOB",
  default_incoterm_year: "2020",
  default_incoterm_place: "",
};

export function SettingsForm({
  settings,
}: {
  settings: CompanySettings | null;
}) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(saveCompanySettings, null);

  const form = useForm<CompanySettingsFormValues>({
    defaultValues: settings
      ? {
          default_payment_terms: settings.default_payment_terms,
          default_incoterm: settings.default_incoterm,
          default_incoterm_year: String(settings.default_incoterm_year ?? 2020),
          default_incoterm_place: settings.default_incoterm_place ?? "",
        }
      : FALLBACK,
    mode: "onBlur",
  });

  useEffect(() => {
    if (state?.success) toast.success("Settings saved");
  }, [state]);

  const fieldErrors = state?.fieldErrors;
  const gate = useSubmitGate();

  return (
    <FormProvider {...form}>
      <form
        action={formAction}
        className="space-y-6"
        onKeyDown={gate.onKeyDown}
        onSubmitCapture={gate.onSubmitCapture}
      >
        <ValidationSummary fieldErrors={fieldErrors} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <FileText className="size-4.5 text-heading" />
              Document defaults
            </CardTitle>
            <CardDescription>
              Pre-filled on every new document. Company identity, bank details,
              logos and number series are set per entity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="rounded-xl bg-lightgray px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Numbering, logo, address and bank details are per-entity. These
              are only the global defaults pre-filled on new documents.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                name="default_incoterm"
                label="Default Incoterm"
                options={[
                  { value: "none", label: "Not specified" },
                  ...INCOTERMS.map((i) => ({ value: i.code, label: i.code })),
                ]}
              />
              <SelectField
                name="default_incoterm_year"
                label="Incoterms year"
                options={[
                  { value: "2020", label: "2020" },
                  { value: "2010", label: "2010" },
                ]}
              />
            </div>

            <TextField
              name="default_incoterm_place"
              label="Default named place"
              placeholder="Karachi"
            />

            <TextareaField
              name="default_payment_terms"
              label="Default payment terms"
              rows={2}
              placeholder="30% advance, 70% against B/L copy"
            />
          </CardContent>
        </Card>

        {state?.error && !state.fieldErrors && (
          <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="min-w-40 gap-2"
            onClick={gate.arm}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save settings
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
