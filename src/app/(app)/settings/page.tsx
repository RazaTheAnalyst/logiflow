import Link from "next/link";
import { AlertTriangle, Building2, ChevronRight, Plus } from "lucide-react";
import { getEntities, loadCompanySettings } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ settings, problem }, entities] = await Promise.all([
    loadCompanySettings(),
    getEntities(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7">
      <PageHeader
        title="Settings"
        description="Entities issue the documents; these defaults apply to every one of them."
      />

      {problem && (
        <div
          role="alert"
          className="rounded-2xl border border-border/40 bg-lightprimary p-5 dark:bg-lightprimary/10"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#8a6000] dark:text-gold" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-[#8a6000] dark:text-gold">
                Database setup incomplete
              </p>
              <p className="leading-relaxed text-[#8a6000]/90 dark:text-gold/90">
                {problem}
              </p>
              <p className="leading-relaxed text-[#8a6000]/90 dark:text-gold/90">
                In the Supabase dashboard open <strong>SQL Editor</strong> and run{" "}
                <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[15px] dark:bg-white/10">
                  supabase/002-fix-settings.sql
                </code>
                , then reload this page.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2.5">
                <Building2 className="size-4.5 text-heading" />
                Entities
              </CardTitle>
              <CardDescription>
                Branches and brands that issue documents — each with its own
                logo, address, bank details, number series and currency.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="gap-1.5 shrink-0">
              <Link href="/settings/entities/new">
                <Plus />
                Add entity
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-[15px] leading-relaxed text-muted-foreground">
              No entities found. Run{" "}
              <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono dark:bg-white/10">
                supabase/004-entities-and-unified-documents.sql
              </code>{" "}
              in the Supabase SQL editor to create the first entity.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {entities.map((entity) => (
                <li key={entity.id}>
                  <Link
                    href={`/settings/entities/${entity.id}`}
                    className="flex items-center gap-4 rounded-xl px-2 py-4 transition-colors hover:bg-lightgray"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-heading">
                        <span className="truncate">{entity.company_name}</span>
                        {entity.is_default && (
                          <Badge variant="secondary" className="text-[0.6875rem]">
                            Default
                          </Badge>
                        )}
                      </p>
                      <p className="mt-1 truncate text-[15px] text-muted-foreground">
                        {[entity.city, entity.country].filter(Boolean).join(", ") ||
                          "No address yet"}
                        {" · "}
                        {entity.doc_prefix}-series · {entity.default_currency}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SettingsForm settings={settings} />
    </div>
  );
}
