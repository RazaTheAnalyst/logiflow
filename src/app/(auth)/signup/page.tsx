import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  const next =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/dashboard";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
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
            Set up your export desk in minutes.
          </h1>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-white/80">
            One account, one company. Add your customers, then produce paperwork
            your freight forwarder will accept.
          </p>
        </div>

        <p className="relative text-[15px] text-white/60">
          Commercial invoices &amp; packing lists
        </p>
      </div>

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

          <AuthForm mode="signup" next={next} />

          <p className="mt-8 text-center text-[13px] text-muted-foreground">
            Engineered by Ali Raza
          </p>
        </div>
      </div>
    </div>
  );
}
