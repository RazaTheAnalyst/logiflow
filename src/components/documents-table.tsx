"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Copy, Download, FileText, Loader2, MoreHorizontal, Package, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DocKind, ShippingDocumentWithLines } from "@/lib/types";
import { cloneDocument, convertProformaToCommercial, deleteDocument } from "@/lib/actions/documents";
import { computeTotals, formatMoney } from "@/lib/money";
import { documentsToCsv, downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export interface KindMeta {
  kind: DocKind;
  /** URL segment for detail/edit/new links: "documents" | "proforma". */
  basePath: string;
  title: string;
  description: string;
  newLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

export const KIND_META: Record<DocKind, KindMeta> = {
  commercial: {
    kind: "commercial",
    basePath: "documents",
    title: "Documents",
    description: "Commercial invoices and packing lists, ready to export.",
    newLabel: "New document",
    emptyTitle: "No documents yet",
    emptyDescription:
      "Create a commercial invoice or packing list for a customer, then export it as a branded PDF.",
  },
  proforma: {
    kind: "proforma",
    basePath: "proforma",
    title: "Proforma invoices",
    description: "Quotations awaiting acceptance — convert to invoice in one click.",
    newLabel: "New proforma",
    emptyTitle: "No proformas yet",
    emptyDescription:
      "Create a proforma invoice for a customer, then convert it once accepted.",
  },
};

function DocumentActions({
  doc,
  meta,
}: {
  doc: ShippingDocumentWithLines;
  meta: KindMeta;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [converting, setConverting] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [cloning, setCloning] = useState(false);
  const isProforma = (doc.doc_kind ?? "commercial") === "proforma";

  async function handleDelete() {
    setIsPending(true);
    const result = await deleteDocument(doc.id);
    setIsPending(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${doc.doc_number} deleted`);
    setConfirming(false);
    router.refresh();
  }

  async function handleClone() {
    setCloning(true);
    const result = await cloneDocument(doc.id);
    setCloning(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${doc.doc_number} duplicated`);
    router.push(`/${meta.basePath}/${result.documentId}`);
    router.refresh();
  }

  async function handleConvert() {
    setConverting(true);
    const result = await convertProformaToCommercial(doc.id);
    setConverting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${doc.doc_number} converted to commercial invoice`);
    router.push(`/documents/${result.documentId}`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${doc.doc_number}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/${meta.basePath}/${doc.id}`}>
              <Pencil />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleClone} disabled={cloning}>
            {cloning ? <Loader2 className="animate-spin" /> : <Copy />}
            Duplicate
          </DropdownMenuItem>
          {isProforma && (
            <DropdownMenuItem onSelect={handleConvert} disabled={converting}>
              {converting ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}
              Convert to invoice
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isProforma ? (
            <DropdownMenuItem asChild>
              <a
                href={`/api/documents/${doc.id}/pdf?kind=proforma`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText />
                Print PI
              </a>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/documents/${doc.id}/pdf?kind=invoice`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText />
                  Print CI
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/documents/${doc.id}/pdf?kind=packing_list`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer />
                  Print PL
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/documents/${doc.id}/pdf?kind=both`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Package />
                  Print both
                </a>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {doc.doc_number}?</DialogTitle>
            <DialogDescription>
              The document and all of its line items will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const PAGE_SIZE = 25;

export function DocumentsTable({
  documents,
  meta = KIND_META.commercial,
}: {
  documents: ShippingDocumentWithLines[];
  meta?: KindMeta;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      [doc.doc_number, doc.po_number, doc.customer?.name, doc.vessel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [documents, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    downloadCsv(`${meta.kind}-documents-${new Date().toISOString().slice(0, 10)}.csv`, documentsToCsv(filtered));
    toast.success(`${filtered.length} documents exported`);
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All documents</CardTitle>
            <CardDescription>
              {filtered.length} of {documents.length} shown · page {safePage + 1} of {pageCount}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(0); }}
              placeholder="Search number, customer, vessel…"
              className="h-11 w-full sm:w-72"
              aria-label="Search documents"
            />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {documents.length === 0 ? (
          <EmptyState
            icon={Package}
            title={meta.emptyTitle}
            description={meta.emptyDescription}
            action={
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/${meta.basePath}/new`}>
                  <Plus />
                  Create document
                </Link>
              </Button>
            }
            className="border-t"
          />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">
            No documents match these filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((doc) => {
                    const totals = computeTotals(doc.line_items ?? [], {
                      freight: Number(doc.freight) || 0,
                      insurance: Number(doc.insurance) || 0,
                    });
                    return (
                      <TableRow key={doc.id}>
                      <TableCell>
                        <Link
                          href={`/${meta.basePath}/${doc.id}`}
                          className="font-semibold text-heading underline-offset-4 hover:underline"
                        >
                          {doc.doc_number}
                        </Link>
                          {doc.po_number && (
                            <p className="text-[15px] text-muted-foreground">
                              PO: {doc.po_number}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate">{doc.customer?.name ?? "—"}</p>
                          {doc.incoterm && (
                            <p className="truncate text-[15px] text-muted-foreground">
                              {doc.incoterm}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatMoney(totals.grandTotal, doc.currency)}
                          <p className="text-xs font-normal text-muted-foreground">{doc.currency}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[15px] text-muted-foreground">
                          {formatDate(doc.issue_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <DocumentActions doc={doc} meta={meta} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">{safePage + 1} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={safePage + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentsPageClient({
  documents,
  meta = KIND_META.commercial,
}: {
  documents: ShippingDocumentWithLines[];
  meta?: KindMeta;
}) {
  return (
    <div className="mx-auto w-full w-full space-y-6">
      {/* The single entry point for creating a document. */}
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <Button asChild size="lg" className="gap-2">
            <Link href={`/${meta.basePath}/new`}>
              <Plus />
              {meta.newLabel}
            </Link>
          </Button>
        }
      />

      <DocumentsTable documents={documents} meta={meta} />
    </div>
  );
}
