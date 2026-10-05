"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Loader2,
  Package,
  Save,
} from "lucide-react";
import { CURRENCIES, DOC_STATUSES, INCOTERMS } from "@/lib/constants";
import { saveDocument, type DocumentActionState } from "@/lib/actions/documents";
import { suggestDocNumber } from "@/lib/actions/numbers";
import { todayISO } from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  DocKind,
  DocumentFormValues,
  Entity,
  LineItem,
} from "@/lib/types";
import { KIND_META } from "@/components/documents-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TextField, NumberField, TextareaField } from "@/components/form/field";
import { SelectField } from "@/components/form/select-field";
import { ValidationSummary } from "@/components/form/error-summary";
import { useSubmitGate } from "@/components/form/submit-gate";
import { WizardSteps } from "@/components/new-doc-steps";
import {
  DocumentTotalsPanel,
  LineItemsEditor,
} from "@/components/document-line-items";

const CUSTOMER_OPTIONS_PLACEHOLDER = "Select a customer…";
const ENTITY_OPTIONS_PLACEHOLDER = "Select an entity…";

function newLineItem(lineNo = 1): LineItem {
  return {
    id: "",
    document_id: null,
    line_no: lineNo,
    description: "",
    hs_code: null,
    part_number: null,
    coo: null,
    quantity: 1,
    unit: "PCS",
    unit_price: 0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 0,
    carton_count: 0,
    package_type: "CTN",
    carton_length_cm: null,
    carton_width_cm: null,
    carton_height_cm: null,
    net_weight_kg: 0,
    gross_weight_kg: 0,
    volume_cbm: 0,
  };
}

export function DocumentForm({
  document,
  customers,
  settings,
  entities,
  suggestedNumber,
  fixedEntityId,
  fixedCustomerId,
  docKind = "commercial",
  basePath = "documents",
  doctype = "both",
  step,
}: {
  document?: DocumentFormValues & { id: string };
  customers: Customer[];
  settings: CompanySettings | null;
  entities: Entity[];
  /** Next number for the initially selected entity (server-side peek). */
  suggestedNumber: string;
  /** Wizard: entity chosen earlier, shown as a chip, not a dropdown. */
  fixedEntityId?: string;
  /** Wizard: buyer chosen earlier, shown as a chip, not a dropdown. */
  fixedCustomerId?: string;
  /** Locked kind for the /proforma flow (hidden input, PI series, PI-only PDF). */
  docKind?: DocKind;
  /** URL segment for back/cancel/detail links: "documents" | "proforma". */
  basePath?: string;
  /** Commercial creation type: tunes the builder (initial goods tab). */
  doctype?: "commercial" | "packing" | "both";
  /** Explicit wizard step for the progress dots (defaults by flow). */
  step?: 1 | 2 | 3 | 4;
}) {
  const router = useRouter();
  const isEdit = Boolean(document?.id);
  const kind = document?.doc_kind ?? docKind;
  const meta = KIND_META[kind];
  const fixedEntity =
    !isEdit && fixedEntityId
      ? (entities.find((entity) => entity.id === fixedEntityId) ?? null)
      : null;
  const fixedCustomer =
    !isEdit && fixedCustomerId
      ? (customers.find((customer) => customer.id === fixedCustomerId) ?? null)
      : null;
  const wizardStep = step ?? (fixedCustomer ? 4 : 3);
  // Query prefix preserving the commercial creation type across wizard steps.
  const typeQuery = doctype !== "both" ? `doctype=${doctype}&` : "";
  // Entity-step URL (type preserved) for change/back links.
  const entityStepHref =
    basePath === "proforma"
      ? `/${basePath}/new`
      : `/${basePath}/new?doctype=${doctype}`;
  // Customer-picker URL for back/change links once an entity is fixed.
  const customerStepHref = fixedEntity
    ? `/${basePath}/new?${typeQuery}entity=${fixedEntity.id}`
    : `/${basePath}/new`;

  const defaultValues = useMemo<DocumentFormValues>(
    () =>
      document ?? {
        entity_id: fixedEntity?.id ?? entities[0]?.id ?? "",
        doc_kind: kind,
        doc_number: suggestedNumber,
        issue_date: todayISO(),
        customer_id: fixedCustomer?.id ?? customers[0]?.id ?? "",
        currency:
          fixedEntity?.default_currency ??
          entities[0]?.default_currency ??
          settings?.default_currency ??
          "USD",
        status: "draft",
        incoterm: settings?.default_incoterm ?? "FOB",
        incoterm_year: settings?.default_incoterm_year ?? 2020,
        incoterm_place: settings?.default_incoterm_place ?? "",
        port_of_loading: "",
        port_of_destination: "",
        vessel: "",
        po_number: "",
        payment_terms: settings?.default_payment_terms ?? "",
        notes: "",
        include_bank_details: true,
        freight: 0,
        insurance: 0,
        line_items: [newLineItem(1)],
      },
    [document, customers, settings, entities, suggestedNumber, fixedEntity, fixedCustomer, kind],
  );

  const [state, formAction, isPending] = useActionState<DocumentActionState, FormData>(
    (prev, formData) => saveDocument(prev, formData, document?.id),
    null,
  );

  const form = useForm<DocumentFormValues>({
    defaultValues,
    mode: "onBlur",
  });

  const { control, setValue, formState } = form;
  const entityId = useWatch({ control, name: "entity_id" });
  const currency = useWatch({ control, name: "currency" });
  const lineItems = useWatch({ control, name: "line_items" }) ?? [];
  const customerId = useWatch({ control, name: "customer_id" });
  const showBank = useWatch({ control, name: "include_bank_details" });
  const gate = useSubmitGate();

  // Switching entity re-previews that entity's next number — until the user
  // has edited the field or the document already exists (numbers never move).
  const [docNumberTouched, setDocNumberTouched] = useState(Boolean(document?.id));
  const lastPeekedEntity = useRef<string | null>(
    defaultValues.entity_id || entities[0]?.id || null,
  );
  const peekToken = useRef(0);
  useEffect(() => {
    if (isEdit || docNumberTouched || !entityId) return;
    if (lastPeekedEntity.current === entityId) return;
    lastPeekedEntity.current = entityId;

    const token = (peekToken.current += 1);
    const entity = entities.find((candidate) => candidate.id === entityId);
    const fallback = entity
      ? `${kind === "proforma" ? entity.pi_prefix : entity.doc_prefix}-${String(
          kind === "proforma" ? entity.pi_next_number : entity.next_number,
        ).padStart(4, "0")}`
      : "";
    let cancelled = false;

    suggestDocNumber(entityId, kind).then((value) => {
      // A slower peek for a previously selected entity must not win.
      if (cancelled || token !== peekToken.current) return;
      setValue("doc_number", value || fallback);
    });

    return () => {
      cancelled = true;
    };
  }, [entityId, entities, isEdit, docNumberTouched, setValue, kind]);

  // Entity switch also adopts that entity's default currency — until the user
  // picks one themselves, and never over a saved document's currency.
  const [currencyTouched, setCurrencyTouched] = useState(Boolean(document?.id));
  useEffect(() => {
    if (currencyTouched || !entityId) return;
    const entity = entities.find((candidate) => candidate.id === entityId);
    if (entity) setValue("currency", entity.default_currency);
  }, [entityId, entities, currencyTouched, setValue]);

  // Unsaved-changes guard: single-company users often keep the builder open.
  useEffect(() => {
    if (!formState.isDirty || isPending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [formState.isDirty, isPending]);

  useEffect(() => {
    if (state?.success && state.documentId) {
      toast.success(isEdit ? "Document updated" : "Document created");
      form.reset(form.getValues(), { keepValues: true });
      // New docs stay for the download dialog below (it navigates onward);
      // edits stay on the page with refreshed data.
      if (isEdit) router.refresh();
    } else if (state?.error && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, isEdit, router, form]);

  // Download dialog after a successful create. Closing it (any button)
  // continues into the saved document, so no extra state is needed.
  const createdId =
    !isEdit && state?.success ? (state.documentId ?? null) : null;

  function closeCreatedDialog() {
    if (state?.documentId) router.push(`/${basePath}/${state.documentId}`);
  }

  // Server-side validation errors are keyed by field. Every section is visible
  // on this single page, so the fix is: surface the summary at the top and
  // move focus to it (keyboard and screen-reader users land on the list).
  const fieldErrors = state?.fieldErrors;
  const hasFieldErrors = Boolean(
    fieldErrors && Object.keys(fieldErrors).length > 0,
  );
  const summaryRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasFieldErrors) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    summaryRef.current?.focus({ preventScroll: true });
  }, [state, hasFieldErrors]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  if (entities.length === 0) {
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

  if (customers.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Add a customer first</CardTitle>
          <CardDescription>
            Every invoice and packing list needs a buyer to bill. Create a
            customer, then come back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/customers">
              <ArrowLeft />
              Go to customers
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const entityOptions = [
    { value: "__none__", label: ENTITY_OPTIONS_PLACEHOLDER },
    ...entities.map((entity) => ({ value: entity.id, label: entity.company_name })),
  ];
  const customerOptions = [
    { value: "__none__", label: CUSTOMER_OPTIONS_PLACEHOLDER },
    ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
  ];

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={
              fixedCustomer
                ? "Back to customer picker"
                : fixedEntity
                  ? "Back to entity picker"
                  : `Back to ${meta.title.toLowerCase()}`
            }
          >
            <Link
              href={
                fixedCustomer
                  ? customerStepHref
                  : fixedEntity
                    ? entityStepHref
                    : `/${basePath}`
              }
            >
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="bg-gradient-to-r from-primary to-[#32c5ff] bg-clip-text font-heading text-2xl font-bold tracking-tight text-transparent">
              {isEdit ? `Edit ${document?.doc_number}` : meta.newLabel}
            </h1>
            {isEdit ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {kind === "proforma"
                  ? "Changes apply to the proforma invoice."
                  : "Changes apply to both the invoice and the packing list."}
              </p>
            ) : (
              fixedEntity && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Issuing as {fixedEntity.company_name}
                  {fixedCustomer && (
                    <>
                      {" "}for {fixedCustomer.name} ·{" "}
                      <Link href={customerStepHref} className="font-medium text-primary hover:underline">
                        Change customer
                      </Link>
                      {" · "}
                    </>
                  )}{" "}
                  <Link href={entityStepHref} className="font-medium text-primary hover:underline">
                    Change entity
                  </Link>
                </p>
              )
            )}
          </div>
          {fixedEntity && (
            <WizardSteps current={wizardStep} />
          )}
        </div>

        <form
          action={formAction}
          className="space-y-5"
          onKeyDown={gate.onKeyDown}
          onSubmitCapture={gate.onSubmitCapture}
        >
          <input
            type="hidden"
            name="line_items"
            value={JSON.stringify(
              lineItems.map((item) => ({
                ...item,
                quantity: Number(item.quantity) || 0,
                unit_price: Number(item.unit_price) || 0,
                discount_percent: Number(item.discount_percent) || 0,
                discount_amount: Number(item.discount_amount) || 0,
                tax_percent: Number(item.tax_percent) || 0,
                carton_count: Number(item.carton_count) || 0,
                carton_length_cm: Number(item.carton_length_cm) || 0,
                carton_width_cm: Number(item.carton_width_cm) || 0,
                carton_height_cm: Number(item.carton_height_cm) || 0,
                net_weight_kg: Number(item.net_weight_kg) || 0,
                gross_weight_kg: Number(item.gross_weight_kg) || 0,
                volume_cbm: Number(item.volume_cbm) || 0,
              })),
            )}
            readOnly
          />

          {/* Untouched creates let the server reserve the number atomically. */}
          <input
            type="hidden"
            name="doc_number_auto"
            value={isEdit || docNumberTouched ? "0" : "1"}
            readOnly
          />
          <input type="hidden" name="doc_kind" value={kind} readOnly />

          {hasFieldErrors && (
            <div ref={summaryRef} tabIndex={-1} className="outline-none">
              <ValidationSummary fieldErrors={fieldErrors} />
            </div>
          )}

          <Card className="border-primary/30 shadow-md lg:overflow-visible">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2.5">
                <Package className="size-5 text-primary" />
                Goods
                <Badge variant="secondary">
                  {lineItems.length} item{lineItems.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
              <CardDescription>
                The star of the show — pricing feeds the invoice, packing feeds
                the packing list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <LineItemsEditor
                fieldErrors={fieldErrors}
                defaultView={doctype === "packing" ? "packing" : "pricing"}
              />
              <div className="rounded-2xl border border-border bg-card px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-heading">Totals</p>
                  <p className="text-xs text-muted-foreground">Updates as you type</p>
                </div>
                <DocumentTotalsPanel currency={currency || "USD"} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Document details</CardTitle>
                <CardDescription>
                  Each entity carries its own number series (for example{" "}
                  <span className="font-medium text-link">UAE-NC-0001</span>) and
                  default currency.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {fixedEntity ? (
                  <div className="space-y-2">
                    <Label className="text-[15px] font-semibold text-link">
                      Entity
                    </Label>
                    <div className="flex h-11 items-center justify-between gap-2 rounded-3xl border border-primary/30 bg-lightprimary/50 px-4">
                      <span className="truncate text-sm font-bold text-heading">
                        {fixedEntity.company_name}
                      </span>
                      <Link
                        href={`/${basePath}/new`}
                        className="shrink-0 text-sm font-medium text-primary hover:underline"
                      >
                        Change
                      </Link>
                    </div>
                    <input
                      type="hidden"
                      name="entity_id"
                      value={entityId}
                      readOnly
                    />
                  </div>
                ) : (
                  <SelectField
                    name="entity_id"
                    label="Entity"
                    options={entityOptions}
                    placeholder={ENTITY_OPTIONS_PLACEHOLDER}
                    required
                    description={fieldErrors?.entity_id}
                  />
                )}
                <TextField
                  name="doc_number"
                  label="Document number"
                  required
                  readOnly={!docNumberTouched}
                  onInteracted={() => setDocNumberTouched(true)}
                  description={fieldErrors?.doc_number}
                />
                <TextField name="issue_date" label="Issue date" type="date" required />
                <SelectField
                  name="currency"
                  label="Currency"
                  options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))}
                  contentClassName="max-h-64"
                  required
                  onInteracted={() => setCurrencyTouched(true)}
                />
                {fixedCustomer ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[15px] font-semibold text-link">
                      Customer
                    </Label>
                    <div className="flex h-11 items-center justify-between gap-2 rounded-3xl border border-primary/30 bg-lightprimary/50 px-4">
                      <span className="truncate text-sm font-bold text-heading">
                        {fixedCustomer.name}
                      </span>
                      <Link
                        href={customerStepHref}
                        className="shrink-0 text-sm font-medium text-primary hover:underline"
                      >
                        Change
                      </Link>
                    </div>
                    <input
                      type="hidden"
                      name="customer_id"
                      value={customerId}
                      readOnly
                    />
                  </div>
                ) : (
                  <SelectField
                    name="customer_id"
                    label="Customer"
                    options={customerOptions}
                    placeholder={CUSTOMER_OPTIONS_PLACEHOLDER}
                    className="sm:col-span-2"
                    required
                    description={
                      fieldErrors?.customer_id ?? selectedCustomer?.country ?? undefined
                    }
                  />
                )}
                <TextField name="po_number" label="PO / Reference" placeholder="PO-2024-118" />
                <SelectField
                  name="status"
                  label="Status"
                  options={DOC_STATUSES.map((s) => ({
                    value: s.value,
                    label: s.label,
                  }))}
                  required
                  description={fieldErrors?.status}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shipment terms</CardTitle>
                <CardDescription>Incoterms with year and named place</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  name="incoterm"
                  label="Incoterm"
                  options={[
                    { value: "none", label: "Not specified" },
                    ...INCOTERMS.map((i) => ({ value: i.code, label: i.label })),
                  ]}
                />
                <SelectField
                  name="incoterm_year"
                  label="Incoterms year"
                  options={[
                    { value: "2020", label: "2020" },
                    { value: "2010", label: "2010" },
                  ]}
                />
                <TextField
                  name="incoterm_place"
                  label="Named place"
                  placeholder="Karachi"
                  className="sm:col-span-2"
                />
                <TextField name="vessel" label="Vessel / Flight" placeholder="MV Ocean Star" />
                <TextField
                  name="port_of_loading"
                  label="Port of loading"
                  placeholder="Port Qasim"
                />
                <TextField
                  name="port_of_destination"
                  label="Port of destination"
                  placeholder="Felixstowe"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Charges</CardTitle>
                <CardDescription>Added on top of the goods total.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <NumberField name="freight" label="Freight" min={0} />
                <NumberField name="insurance" label="Insurance" min={0} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes &amp; options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TextareaField
                  name="payment_terms"
                  label="Payment terms"
                  rows={2}
                  placeholder="30% advance, 70% against B/L copy"
                />

                <TextareaField
                  name="notes"
                  label="Notes / declarations"
                  rows={2}
                  placeholder="Goods are of Pakistani origin. Marked FOB Karachi."
                />

                <div className="flex items-center gap-2.5 pt-0.5">
                  <Checkbox
                    id="include_bank_details"
                    checked={showBank !== false}
                    onCheckedChange={(checked) =>
                      setValue("include_bank_details", checked === true)
                    }
                  />
                  <Label
                    htmlFor="include_bank_details"
                    className="text-sm font-normal text-heading"
                  >
                    Show bank details on the invoice PDF
                  </Label>
                </div>
                <input
                  type="hidden"
                  name="include_bank_details"
                  value={showBank ? "1" : "0"}
                  readOnly
                />
              </CardContent>
            </Card>
          </div>

          {document?.id && (
            <Card>
              <CardHeader>
                <CardTitle>Export PDF</CardTitle>
                <CardDescription>
                  The PDFs reflect the last saved version of this document.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {kind === "proforma" ? (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a
                      href={`/api/documents/${document.id}/pdf?kind=proforma`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText />
                      Proforma invoice
                    </a>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a
                        href={`/api/documents/${document.id}/pdf?kind=invoice`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText />
                        Commercial invoice
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a
                        href={`/api/documents/${document.id}/pdf?kind=packing_list`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Package />
                        Packing list
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a
                        href={`/api/documents/${document.id}/pdf?kind=both`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download />
                        Both documents
                      </a>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {state?.error && !state.fieldErrors && (
            <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error">
              {state.error}
            </p>
          )}

          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
            <Button asChild variant="outline" className="gap-1.5">
              <Link href={`/${basePath}`}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              className="gap-1.5"
              disabled={isPending}
              onClick={gate.arm}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? "Save changes" : "Create document"}
            </Button>
          </div>
        </form>

        <Dialog
          open={createdId !== null}
          onOpenChange={(open) => {
            if (!open) closeCreatedDialog();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{kind === "proforma" ? "Proforma created" : "Document created"}</DialogTitle>
              <DialogDescription>
                {kind === "proforma"
                  ? "Your proforma invoice is ready — file is named by document number."
                  : "Your commercial invoice and packing list are ready — files are named by document number."}
              </DialogDescription>
            </DialogHeader>
            {createdId && (
              <div className="grid gap-2">
                {kind === "proforma" ? (
                  <Button asChild variant="outline" className="gap-1.5">
                    <a
                      href={`/api/documents/${createdId}/pdf?kind=proforma`}
                      download
                    >
                      <FileText />
                      Download proforma invoice
                    </a>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="gap-1.5">
                      <a
                        href={`/api/documents/${createdId}/pdf?kind=invoice`}
                        download
                      >
                        <FileText />
                        Download commercial invoice
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="gap-1.5">
                      <a
                        href={`/api/documents/${createdId}/pdf?kind=packing_list`}
                        download
                      >
                        <Package />
                        Download packing list
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="gap-1.5">
                      <a href={`/api/documents/${createdId}/pdf?kind=both`} download>
                        <Download />
                        Download both
                      </a>
                    </Button>
                  </>
                )}
                <Button className="mt-1 gap-1.5" onClick={closeCreatedDialog}>
                  Open document
                  <ArrowRight />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </FormProvider>
  );
}
