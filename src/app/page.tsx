import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function RootPage() {
  if (!isSupabaseConfigured()) redirect("/setup");

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
