import Link from "next/link";
import { Database, KeyRound, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Setup required" };

const STEPS = [
  {
    title: "Create a Supabase project",
    body: "Sign up at supabase.com, then create a new project and wait for the database to be provisioned.",
    icon: Database,
  },
  {
    title: "Run the schema",
    body: "Open the SQL Editor in your Supabase dashboard and paste the contents of supabase/schema.sql, then run it.",
    icon: Terminal,
  },
  {
    title: "Add your keys",
    body: "Copy .env.example to .env.local and fill in your project URL and publishable key from Project Settings → API.",
    icon: KeyRound,
  },
];

export default function SetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_20px_-8px_rgb(93_135_255/0.8)]">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.5 3.2L12 10.6 5.5 7.4 12 4.2ZM5 9.2l6 3v7.6l-6-3V9.2Zm8 10.6v-7.6l6-3v7.6l-6 3Z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold tracking-tight text-heading">
            Logi<span className="text-primary">Flow</span>
            <span className="text-primary"> ▶</span>
          </p>
        </div>

        <Card>
          <CardHeader>
                        <CardTitle className="text-2xl font-semibold tracking-[-0.02em] text-heading">
              Connect Supabase to continue
            </CardTitle>
            <CardDescription className="text-[0.9375rem]">
              LogiFlow stores customers, documents and your logo in Supabase.
              Three steps and you&apos;re live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="space-y-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lightprimary text-primary">
                    <step.icon className="size-4.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-heading">
                      <span className="mr-2 text-muted-foreground">
                        {index + 1}.
                      </span>
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border bg-lightgray p-5 font-mono text-[15px] leading-relaxed">
              <p className="text-muted-foreground"># .env.local</p>
              <p>NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                asChild
                className="flex-1 gap-1.5"
              >
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Supabase dashboard
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
