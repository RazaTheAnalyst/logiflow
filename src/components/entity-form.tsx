"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Hash,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import {
  deleteEntity,
  saveEntity,
  type EntityActionState,
} from "@/lib/actions/entities";
import { CURRENCIES, COUNTRIES } from "@/lib/constants";
import type { Entity, EntityFormValues } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField, NumberField } from "@/components/form/field";
import { SelectField } from "@/components/form/select-field";
import { ValidationSummary } from "@/components/form/error-summary";
import { useSubmitGate } from "@/components/form/submit-gate";
import { LogoUpload } from "@/components/logo-upload";

const GRID = "grid gap-5 sm:grid-cols-2";

const FALLBACK: EntityFormValues = {
  company_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  phone: "",
  email: "",
  website: "",
  tax_id: "",
  trade_license: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_swift: "",
  doc_prefix: "INV",
  next_number: 1,
  default_currency: "USD",
  is_default: "0",
};

export function EntityForm({
  entity,
  logoUrl,
}: {
  entity?: Entity;
  logoUrl?: string | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(entity?.id);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [state, formAction, isPending] = useActionState<
    EntityActionState,
    FormData
  >(
    (prev, formData) => saveEntity(prev, formData, entity?.id),
    null,
  );

  const form = useForm<EntityFormValues>({
    defaultValues: entity
      ? {
          company_name: entity.company_name,
          address_line1: entity.address_line1 ?? "",
          address_line2: entity.address_line2 ?? "",
          city: entity.city ?? "",
          state: entity.state ?? "",
          postal_code: entity.postal_code ?? "",
          country: entity.country ?? "",
          phone: entity.phone ?? "",
          email: entity.email ?? "",
          website: entity.website ?? "",
          tax_id: entity.tax_id ?? "",
          trade_license: entity.trade_license ?? "",
          bank_name: entity.bank_name ?? "",
          bank_account_name: entity.bank_account_name ?? "",
          bank_account_number: entity.bank_account_number ?? "",
          bank_swift: entity.bank_swift ?? "",
          doc_prefix: entity.doc_prefix,
          next_number: entity.next_number,
          default_currency: entity.default_currency,
          is_default: entity.is_default ? "1" : "0",
        }
      : FALLBACK,
    mode: "onBlur",
  });

  useEffect(() => {
    if (state?.success && state.entityId) {
      toast.success(isEdit ? "Entity updated" : "Entity created");
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/settings/entities/${state.entityId}`);
      }
    } else if (state?.error && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, isEdit, router]);

  async function handleDelete() {
    if (!entity) return;
    setDeleting(true);
    const result = await deleteEntity(entity.id);
    setDeleting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${entity.company_name} deleted`);
    router.push("/settings");
    router.refresh();
  }

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
              <Building2 className="size-4.5 text-heading" />
              Identity
            </CardTitle>
            <CardDescription>
              Printed in the header of every document this entity issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {entity && (
              <LogoUpload
                entityId={entity.id}
                logoUrl={logoUrl ?? null}
                companyName={entity.company_name || "this entity"}
              />
            )}

            <div className="space-y-5">
              <TextField
                name="company_name"
                label="Company name"
                placeholder="Acme Trading LLC"
                required
                description={fieldErrors?.company_name}
              />
              <div className={GRID}>
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="sales@acme.com"
                  description={fieldErrors?.email}
                />
                <TextField name="phone" label="Phone" placeholder="+971 4 123 4567" />
              </div>
              <TextField name="website" label="Website" placeholder="www.acme.com" />
              <div className={GRID}>
                <TextField
                  name="tax_id"
                  label="Tax / VAT number"
                  placeholder="TRN 1001234567890003"
                />
                <TextField
                  name="trade_license"
                  label="Trade license no."
                  placeholder="CN-1234567"
                  description="Printed in the PDF footer next to the VAT number."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered address</CardTitle>
            <CardDescription>Shown in the exporter block of every PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TextField
              name="address_line1"
              label="Street address"
              placeholder="Office 12, Jebel Ali Free Zone"
            />
            <TextField
              name="address_line2"
              label="Address line 2"
              placeholder="Warehouse 4"
            />
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField name="city" label="City" placeholder="Dubai" />
              <TextField name="state" label="State / Emirate" placeholder="Dubai" />
              <TextField name="postal_code" label="Postcode" placeholder="00000" />
            </div>
            <TextField name="country" label="Country" placeholder="United Arab Emirates" list="entity-countries" />
            <datalist id="entity-countries">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <Banknote className="size-4.5 text-heading" />
              Bank details
            </CardTitle>
            <CardDescription>
              Shown in the payment block of this entity&apos;s commercial invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className={GRID}>
            <TextField name="bank_name" label="Bank" placeholder="Emirates NBD" />
            <TextField
              name="bank_account_name"
              label="Account name"
              placeholder="Acme Trading LLC"
            />
            <TextField
              name="bank_account_number"
              label="IBAN / Account number"
              placeholder="AE07 0331 2345 6789 0123 456"
            />
            <TextField name="bank_swift" label="SWIFT / BIC" placeholder="EBILAEAD" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <Hash className="size-4.5 text-heading" />
              Numbering &amp; defaults
            </CardTitle>
            <CardDescription>
              One series per entity, formatted{" "}
              <span className="font-medium text-link">{entity?.doc_prefix || "UAE-NC"}-0001</span>.
              Existing numbers are never reissued.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                name="doc_prefix"
                label="Number prefix"
                placeholder="UAE-NC"
                required
                description={fieldErrors?.doc_prefix}
              />
              <NumberField
                name="next_number"
                label="Next number"
                min={1}
                description={fieldErrors?.next_number}
              />
              <SelectField
                name="default_currency"
                label="Default currency"
                options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))}
                contentClassName="max-h-64"
                required
              />
            </div>
            <SelectField
              name="is_default"
              label="Default entity"
              options={[
                { value: "1", label: "Yes — pre-selected for new documents" },
                { value: "0", label: "No" },
              ]}
              description={
                fieldErrors?.is_default ??
                "The default entity is pre-selected when creating a document."
              }
            />
          </CardContent>
        </Card>

        {state?.error && !state.fieldErrors && (
          <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/settings">
                <ArrowLeft />
                Back
              </Link>
            </Button>
            {entity && (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-error hover:text-error"
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
                Delete entity
              </Button>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="min-w-40 gap-2"
            onClick={gate.arm}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Save entity" : "Create entity"}
          </Button>
        </div>
      </form>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {entity?.company_name}?</DialogTitle>
            <DialogDescription>
              Entities with documents cannot be deleted, and at least one entity
              must remain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
