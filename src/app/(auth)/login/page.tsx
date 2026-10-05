import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getDefaultEntity } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in" };

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return "/dashboard";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/dashboard";
  return candidate;
}

const HIGHLIGHTS = [
  "Customers saved once, reused on every document",
  "26 currencies and the full Incoterms 2020 set",
  "PDF export for invoice, packing list, or both",
];

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const entity = await getDefaultEntity();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: soft blue panel with the product promise. */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          className="pointer-events-none absolute -end-24 -top-24 size-[30rem] rounded-full bg-white/[0.07]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-28 -start-16 size-[24rem] rounded-full bg-info/20 blur-3xl"
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-white text-primary">
            <svg viewBox="0 0 24 24" className="size-5.5" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.5 3.2L12 10.6 5.5 7.4 12 4.2ZM5 9.2l6 3v7.6l-6-3V9.2Zm8 10.6v-7.6l6-3v7.6l-6 3Z"
              />
            </svg>
          </div>
          <p className="text-xl font-bold tracking-[-0.02em] text-white">
            LogiFlow
          </p>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Every invoice and packing list, ready to ship.
          </h1>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-white/80">
            Build the shipment once and export branded commercial invoices and
            packing lists with Incoterms, packing details and bank information
            already filled in.
          </p>

          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                  <Check className="size-3" />
                </span>
                <span className="text-[0.9375rem] leading-relaxed text-white/85">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[15px] text-white/60">
          {entity?.company_name ?? "Export documentation for logistics teams"}
        </p>
      </div>

      {/* Right: the form on the page canvas. */}
      <div className="flex items-center justify-center bg-lightgray px-6 py-14 sm:px-12">
        <div className="w-full max-w-[26rem]">
          <div className="mb-9 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-white">
                <svg viewBox="0 0 24 24" className="size-5.5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.5 3.2L12 10.6 5.5 7.4 12 4.2ZM5 9.2l6 3v7.6l-6-3V9.2Zm8 10.6v-7.6l6-3v7.6l-6 3Z"
                  />
                </svg>
              </div>
              <p className="text-xl font-bold tracking-[-0.02em] text-heading">
                LogiFlow
              </p>
            </Link>
          </div>

          <AuthForm mode="login" next={safeNext(params.next)} />

          <p className="mt-8 text-center text-[13px] text-muted-foreground">
            Engineered by Ali Raza
          </p>
        </div>
      </div>
    </div>
  );
}
