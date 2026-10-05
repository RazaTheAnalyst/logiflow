"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import type { Customer } from "@/lib/types";
import type { CustomerDocStats } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  CustomerDialog,
  CustomerRowActions,
  CustomersEmpty,
} from "@/components/customers";
import { CustomerSearchInput } from "@/components/customers";

export function CustomersTable({
  customers,
  docStats = {},
}: {
  customers: Customer[];
  docStats?: Record<string, CustomerDocStats>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [
        customer.name,
        customer.contact_person,
        customer.email,
        customer.country,
        customer.city,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [customers, query]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            {customers.length} customer{customers.length === 1 ? "" : "s"} on file
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CustomerSearchInput value={query} onChange={setQuery} />
          <CustomerDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus />
                New customer
              </Button>
            }
          />
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {customers.length === 0 ? (
          <CustomersEmpty />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No customers match “{query}”.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-medium">{customer.name}</p>
                      {customer.tax_id && (
                        <p className="truncate text-xs text-muted-foreground">
                          Tax ID: {customer.tax_id}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {customer.contact_person ? (
                        <p className="truncate text-sm">{customer.contact_person}</p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {customer.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.email}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate text-sm">
                        {[customer.city, customer.country].filter(Boolean).join(", ") ||
                          "—"}
                      </p>
                      {customer.phone && (
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.phone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {(() => {
                        const stats = docStats[customer.id];
                        if (!stats) {
                          return <span className="text-muted-foreground">—</span>;
                        }
                        const href =
                          stats.latestId && stats.latestKind
                            ? `/${stats.latestKind === "proforma" ? "proforma" : "documents"}/${stats.latestId}`
                            : undefined;
                        return (
                          <div>
                            <p className="text-sm font-medium tabular-nums">
                              {stats.count} doc{stats.count === 1 ? "" : "s"}
                            </p>
                            {stats.latestNumber && href && (
                              <Link
                                href={href}
                                className="truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                              >
                                {stats.latestNumber}
                              </Link>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <CustomerRowActions customer={customer} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CustomersPageClient({
  customers,
  docStats = {},
}: {
  customers: Customer[];
  docStats?: Record<string, CustomerDocStats>;
}) {
  return (
    <div className="mx-auto w-full w-full space-y-6">
      <PageHeader
        title="Customers"
        description="Save a buyer once, then reuse their details on every shipment."
        actions={
          <CustomerDialog
            trigger={
              <Button className="gap-1.5">
                <Plus />
                New customer
              </Button>
            }
          />
        }
      />

      {customers.length === 0 ? (
        <Card>
          <CustomersEmpty />
        </Card>
      ) : (
        <CustomersTable customers={customers} docStats={docStats} />
      )}
    </div>
  );
}

export function CustomerCountBadge({ count }: { count: number }) {
  return <Badge variant="secondary">{count}</Badge>;
}
