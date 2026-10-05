"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { FormProvider, useForm } from "react-hook-form";
import type { Customer, CustomerFormValues } from "@/lib/types";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerActionState,
} from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TextField, TextareaField } from "@/components/form/field";
import { EmptyState } from "@/components/empty-state";
import { useSubmitGate } from "@/components/form/submit-gate";

const EMPTY: CustomerFormValues = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  tax_id: "",
  notes: "",
};

function toFormValues(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    contact_person: customer.contact_person ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address_line1: customer.address_line1 ?? "",
    address_line2: customer.address_line2 ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    postal_code: customer.postal_code ?? "",
    country: customer.country ?? "",
    tax_id: customer.tax_id ?? "",
    notes: customer.notes ?? "",
  };
}

function CustomerFields({ fieldErrors }: { fieldErrors?: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <TextField
        name="name"
        label="Company name"
        placeholder="Acme Trading Ltd."
        required
        autoComplete="organization"
        {...fieldErrors?.name ? { description: fieldErrors.name } : {}}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="contact_person"
          label="Contact person"
          placeholder="John Smith"
          {...fieldErrors?.contact_person ? { description: fieldErrors.contact_person } : {}}
        />
        <TextField
          name="tax_id"
          label="Tax / VAT ID"
          placeholder="GB123456789"
          {...fieldErrors?.tax_id ? { description: fieldErrors.tax_id } : {}}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="email"
          label="Email"
          type="email"
          placeholder="orders@acme.com"
          {...fieldErrors?.email ? { description: fieldErrors.email } : {}}
        />
        <TextField name="phone" label="Phone" placeholder="+44 20 7946 0000" />
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-lightgray p-5">
        <p className="text-[15px] font-semibold text-foreground/80">Address</p>
        <TextField name="address_line1" label="Street address" placeholder="12 Harbour Road" />
        <TextField name="address_line2" label="Address line 2" placeholder="Unit 4, Dockside" />
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField name="city" label="City" placeholder="Felixstowe" />
          <TextField name="state" label="State / Province" placeholder="Suffolk" />
          <TextField name="postal_code" label="Postcode" placeholder="IP11 3TU" />
        </div>
        <TextField name="country" label="Country" placeholder="United Kingdom" />
      </div>

      <TextareaField
        name="notes"
        label="Notes"
        rows={2}
        placeholder="Delivery instructions, dock booking details…"
      />
    </div>
  );
}

export function CustomerDialog({
  customer,
  trigger,
  onCreated,
}: {
  customer?: Customer;
  trigger?: React.ReactNode;
  /** Fires with the new id after a successful create (wizard inline-create). */
  onCreated?: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(customer);

  const form = useForm<CustomerFormValues>({
    defaultValues: customer ? toFormValues(customer) : EMPTY,
    mode: "onBlur",
  });

  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<CustomerActionState>(null);
  const gate = useSubmitGate();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter in a text control submits implicitly — only an explicit Save
    // click (or keyboard activation of the Save button) may proceed.
    if (!gate.consume()) return;
    setState(null);

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result =
        isEdit && customer
          ? await updateCustomer(customer.id, null, formData)
          : await createCustomer(null, formData);

      if (result.success) {
        toast.success(isEdit ? "Customer updated" : "Customer created");
        setOpen(false);
        form.reset(customer ? toFormValues(customer) : EMPTY);
        if (!isEdit && result.customerId) onCreated?.(result.customerId);
        return;
      }

      if (result.error) toast.error(result.error);
      setState(result);
    });
  }

  const fieldErrors = state?.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-1.5">
            <Plus />
            New customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update details for ${customer?.name}.`
              : "Details appear on invoices and packing lists."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={handleSubmit}
            onKeyDown={gate.onKeyDown}
            className="space-y-5 px-1 py-5"
          >
            <CustomerFields fieldErrors={fieldErrors} />

            {state?.error && (
              <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} onClick={gate.arm}>
                {isPending && <Loader2 className="animate-spin" />}
                {isEdit ? "Save changes" : "Create customer"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerRowActions({ customer }: { customer: Customer }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${customer.name} deleted`);
      setConfirming(false);
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <CustomerDialog
          customer={customer}
          trigger={
            <Button variant="ghost" size="icon" className="size-8" aria-label="Edit customer">
              <Pencil className="size-4" />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-error hover:text-error"
          aria-label="Delete customer"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {customer.name}?</DialogTitle>
            <DialogDescription>
              This removes the customer from your list. Documents already created
              for them are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CustomersEmpty() {
  return (
    <EmptyState
      icon={Users}
      title="No customers yet"
      description="Add the buyers and shipping destinations you invoice. Their details are pulled straight onto your PDFs."
      action={
        <CustomerDialog
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus />
              Add first customer
            </Button>
          }
        />
      }
    />
  );
}

export function CustomerSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search name, country or email…"
      className="h-11 max-w-xs"
      aria-label="Search customers"
    />
  );
}
