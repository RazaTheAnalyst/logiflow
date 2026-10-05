import { proxy } from "@/lib/supabase/proxy";

export { proxy };

// The matcher must be statically analysable here, so it can't live in the
// module above. Static assets are excluded so they never hit the session check.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
