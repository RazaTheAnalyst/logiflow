"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

/** `next` arrives as a prop so the form itself stays server-renderable. */
export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();

    const supabase = createClient();
    let result;

    if (isSignup) {
      result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    // Supabase may require email confirmation before a session exists.
    if (isSignup && !result.data.session) {
      toast.success("Account created. Check your email to confirm, then sign in.");
      router.push("/login");
      return;
    }

    toast.success(isSignup ? "Welcome to LogiFlow!" : "Signed in");
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
  }

  return (
    <Card className="w-full border-0 bg-transparent shadow-none ring-0">
      <CardHeader className="space-y-2 px-0">
        <CardTitle className="text-[1.75rem] font-semibold tracking-[-0.02em] text-heading">
          {isSignup ? "Create your account" : "Welcome back"}
        </CardTitle>
        <CardDescription className="text-[0.9375rem]">
          {isSignup
            ? "Set up LogiFlow for your export documentation workflow."
            : "Sign in to manage invoices and packing lists."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Jane Doe"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••"
              minLength={isSignup ? 8 : undefined}
              required
            />
            {isSignup && (
              <p className="text-[15px] text-muted-foreground">
                Use at least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-error/30 bg-error/8 px-4 py-3 text-sm font-medium text-error"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2"
            disabled={loading || isPending}
          >
            {loading || isPending ? (
              <Loader2 className="animate-spin" />
            ) : isSignup ? (
              <UserPlus />
            ) : (
              <LogIn />
            )}
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "No account yet? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
