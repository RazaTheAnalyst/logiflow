import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  ReceiptText,
  Users,
} from "lucide-react";
import { getDashboardStats, getEntities } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [stats, entities] = await Promise.all([
    getDashboardStats(),
    getEntities(),
  ]);

  const tiles = [
    {
      label: "Commercial",
      value: stats.commercialCount,
      icon: FileText,
      href: "/documents",
      tone: "bg-lightprimary text-primary",
      bar: "bg-primary",
    },
    {
      label: "Proforma",
      value: stats.proformaCount,
      icon: ReceiptText,
      href: "/proforma",
      tone: "bg-lightprimary text-[#0a7ea4] dark:text-info",
      bar: "bg-info",
    },
    {
      label: "Customers",
      value: stats.customerCount,
      icon: Users,
      href: "/customers",
      tone: "bg-lightprimary text-[#8a6000] dark:text-gold",
      bar: "bg-warning",
    },
    {
      label: "Entities",
      value: entities.length,
      icon: Building2,
      href: "/settings",
      tone: "bg-lightgray text-heading",
      bar: "bg-heading",
    },
  ] as const;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          stats.documentCount === 0
            ? "Create your first document to get started."
            : `${stats.commercialCount} commercial · ${stats.proformaCount} proforma · ${stats.customerCount} customer${stats.customerCount === 1 ? "" : "s"}.`
        }
        actions={
          <Button asChild size="lg" className="gap-2">
            <Link href="/documents/new">
              <FileText />
              New document
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="group">
            <Card className="relative h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
              <span
                className={cn(
                  "absolute inset-y-0 start-0 w-1 transition-all group-hover:w-1.5",
                  tile.bar,
                )}
                aria-hidden
              />
              <CardContent className="flex items-start justify-between gap-3 ps-6">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-muted-foreground">
                    {tile.label}
                  </p>
                  <p className="mt-2 text-[2.125rem] font-semibold leading-none tabular-nums tracking-[-0.02em] text-heading">
                    {tile.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    tile.tone,
                  )}
                >
                  <tile.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Entities</CardTitle>
            <CardDescription>Branches issuing documents</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {entities.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No entities yet.{" "}
                <Link href="/settings" className="font-medium text-primary hover:underline">
                  Add one in Settings
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {entities.slice(0, 5).map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-lightgray"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-heading">
                          <span className="truncate">{entity.company_name}</span>
                          {entity.is_default && (
                            <Badge variant="secondary" className="shrink-0 text-[0.6875rem]">
                              Default
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                          {entity.doc_prefix}-series · {entity.default_currency}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>By document count</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topCustomers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No customers yet.{" "}
                <Link href="/customers" className="font-medium text-primary hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {stats.topCustomers.map((c) => (
                  <li key={c.name}>
                    <Link
                      href="/customers"
                      className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-lightgray"
                    >
                      <span className="truncate text-sm text-heading">{c.name}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                        {c.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent documents</CardTitle>
            <CardDescription>Latest shipments on file</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Build a commercial invoice, packing list or proforma."
                action={
                  <Button asChild size="sm">
                    <Link href="/documents/new">Create document</Link>
                  </Button>
                }
                className="border-t"
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {stats.recent.map((doc) => {
                  const isProforma =
                    (doc.doc_kind ?? "commercial") === "proforma";
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/${isProforma ? "proforma" : "documents"}/${doc.id}`}
                        className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-lightgray"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">{doc.doc_number}</span>
                            {isProforma && (
                              <Badge variant="outline" className="shrink-0 text-[0.6875rem]">
                                PI
                              </Badge>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                            {doc.customer?.name ?? "Unknown customer"}
                          </p>
                        </div>
                        <span className="hidden shrink-0 text-[13px] tabular-nums text-muted-foreground sm:block">
                          {formatDate(doc.issue_date)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/documents">
            View all documents
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
